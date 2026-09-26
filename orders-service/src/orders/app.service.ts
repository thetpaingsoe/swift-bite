import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
  ConflictException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { and, count, desc, eq } from 'drizzle-orm';
import { orderItems, orders, type Order } from '../db/schema';
import { DbService } from '../db/db.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DiscoveryService } from '../consul/discovery.service';
import { ConfigService } from '@nestjs/config';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';

interface MenuItem {
  id: string;
  name: string;
  price: number | string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject('KITCHEN_SERVICE') private readonly kitchenClient: ClientProxy,
    private readonly dbService: DbService,
    private readonly httpService: HttpService,
    private readonly discovery: DiscoveryService,
    private readonly configService: ConfigService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId?: string) {
    const lines = await Promise.all(
      dto.lines.map(async (line) => {
        const item = await this.fetchItem(line.menuItemId);
        const unitPrice = Number(item.price);
        return {
          menuItemId: line.menuItemId,
          itemName: item.name,
          itemPrice: String(unitPrice),
          quantity: line.quantity,
          lineTotal: unitPrice * line.quantity,
        };
      }),
    );

    const totalPrice = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const { correlationId } = resolveCorrelationId(
      correlationStorage.getStore()?.correlationId,
    );

    let order!: Order;
    try {
      [order] = await this.dbService.db
        .insert(orders)
        .values({
          userId: userId ?? null,
          customerName: dto.customerName,
          totalPrice: String(totalPrice),
          street: dto.street,
          area: dto.area,
          phone: dto.phone,
          note: dto.note ?? null,
          status: 'pending',
          correlationId,
        })
        .returning();

      await this.dbService.db.insert(orderItems).values(
        lines.map(({ lineTotal, ...line }) => ({
          ...line,
          orderId: order.id,
        })),
      );
    } catch (error) {
      this.logger.error('Failed to persist order', error as Error);
      throw new BadGatewayException('Could not save the order');
    }

    this.logger.log(
      `Order saved to DB: ${order.id} (${lines.length} lines)`,
    );

    try {
      await firstValueFrom(
        this.kitchenClient
          .emit('order_created', {
            orderId: order.id,
            customerName: order.customerName,
            lines: lines.map(({ menuItemId, itemName, quantity }) => ({
              menuItemId,
              itemName,
              quantity,
            })),
            street: order.street,
            area: order.area,
            phone: order.phone,
            note: order.note,
            correlationId,
          })
          .pipe(timeout(5000)),
      );
      this.logger.log('Event emitted to kitchen queue');
    } catch (error) {
      this.logger.error(
        `Order ${order.id} saved but could not notify kitchen`,
        error as Error,
      );
    }

    return { success: true, orderId: order.id };
  }

  async listOrders(
    userId?: string,
    role?: string,
    page = 1,
    limit = 10,
    status?: string,
  ) {
    const conditions = [];
    if (role !== 'admin') {
      conditions.push(eq(orders.userId, userId ?? ''));
    }
    if (status) {
      conditions.push(eq(orders.status, status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await this.dbService.db
      .select({ total: count() })
      .from(orders)
      .where(where);

    const rows = await this.dbService.db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const data = await Promise.all(
      rows.map(async (order) => ({
        ...order,
        lines: await this.dbService.db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id)),
      })),
    );

    return {
      data,
      meta: { total, page, limit, pageCount: Math.ceil(total / limit) },
    };
  }

  async getOrder(id: string, userId?: string, role?: string) {
    const [order] = await this.dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order || (role !== 'admin' && order.userId !== userId)) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const lines = await this.dbService.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    return { ...order, lines };
  }

  async updateStatus(orderId: string, status: string) {
    const [current] = await this.dbService.db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current || current.status === 'cancelled') {
      return current;
    }

    const [order] = await this.dbService.db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();

    if (order) {
      this.logger.log(`Order ${orderId} status updated to ${status}`);
    }

    return order;
  }

  async cancelOrder(id: string, userId?: string, role?: string) {
    const order = await this.getOrder(id, userId, role);

    if (order.status !== 'pending') {
      throw new ConflictException(
        `Order cannot be cancelled from status ${order.status}`,
      );
    }

    const [cancelled] = await this.dbService.db
      .update(orders)
      .set({ status: 'cancelled' })
      .where(eq(orders.id, id))
      .returning();

    this.logger.log(`Order ${id} cancelled by user ${userId}`);

    return cancelled;
  }

  private async fetchItem(menuItemId: string): Promise<MenuItem> {
    const fallback = this.configService.get<string>(
      'ITEM_SERVICE_URL',
      'http://localhost:3001',
    );
    const baseUrl = await this.discovery.getServiceUrl(
      'item-service',
      fallback,
    );
    try {
      const response = await firstValueFrom(
        this.httpService.get<MenuItem>(`${baseUrl}/items/${menuItemId}`),
      );
      return response.data;
    } catch (error) {
      if (!(error as any)?.response) {
        this.discovery.invalidate('item-service');
      }
      throw new NotFoundException(`Menu item with ID ${menuItemId} not found`);
    }
  }
}

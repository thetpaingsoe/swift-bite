import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { orders } from '../db/schema';
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
  price: number;
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
    const item = await this.fetchItem(dto.menuItemId);

    const totalPrice = item.price * dto.quantity;
    const { correlationId } = resolveCorrelationId(
      correlationStorage.getStore()?.correlationId,
    );

    let order;
    try {
      [order] = await this.dbService.db
        .insert(orders)
        .values({
          userId: userId ?? null,
          customerName: dto.customerName,
          menuItemId: dto.menuItemId,
          itemName: item.name,
          itemPrice: String(item.price),
          quantity: dto.quantity,
          totalPrice: String(totalPrice),
          street: dto.street,
          area: dto.area,
          status: 'pending',
          correlationId,
        })
        .returning();
    } catch (error) {
      this.logger.error('Failed to persist order', error as Error);
      throw new BadGatewayException('Could not save the order');
    }

    this.logger.log(`Order saved to DB: ${order.id}`);

    try {
      await firstValueFrom(
        this.kitchenClient
          .emit('order_created', {
            orderId: order.id,
            customerName: order.customerName,
            itemName: order.itemName,
            quantity: order.quantity,
            street: order.street,
            area: order.area,
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

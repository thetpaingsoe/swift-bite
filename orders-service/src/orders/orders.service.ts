import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
  ConflictException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import CircuitBreaker from 'opossum';
import { and, count, desc, eq } from 'drizzle-orm';
import { orderItems, orders, type Order } from '../db/schema';
import { DbService } from '../db/db.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { KitchenClientService } from '../kitchen-client/kitchen-client.service';
import { DiscoveryService } from '../consul/discovery.service';
import { ConfigService } from '@nestjs/config';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import { MAX_ATTEMPTS, RETRY_DELAY_MS, sleep } from '../rmq/rmq-retry';

interface MenuItem {
  id: string;
  name: string;
  price: number | string;
}

const ITEM_FETCH_TIMEOUT_MS = 5000;
const ITEM_BREAKER_VOLUME_THRESHOLD = 5;
const ITEM_BREAKER_RESET_TIMEOUT_MS = 30000;
const ITEM_BREAKER_ERROR_THRESHOLD = 50;
const ITEM_BREAKER_TIMEOUT_MS = 20000;

@Injectable()
export class OrdersService implements OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private readonly itemBreaker: CircuitBreaker<[string], MenuItem>;

  constructor(
    private readonly kitchenClient: KitchenClientService,
    private readonly dbService: DbService,
    private readonly httpService: HttpService,
    private readonly discovery: DiscoveryService,
    private readonly configService: ConfigService,
  ) {
    const resetTimeout = Number(
      this.configService.get<number>(
        'ITEM_BREAKER_RESET_TIMEOUT_MS',
        ITEM_BREAKER_RESET_TIMEOUT_MS,
      ),
    );
    this.itemBreaker = new CircuitBreaker(
      (menuItemId: string) => this.fetchItemWithRetry(menuItemId),
      {
        timeout: ITEM_BREAKER_TIMEOUT_MS,
        errorThresholdPercentage: ITEM_BREAKER_ERROR_THRESHOLD,
        volumeThreshold: ITEM_BREAKER_VOLUME_THRESHOLD,
        resetTimeout:
          Number.isFinite(resetTimeout) && resetTimeout > 0
            ? resetTimeout
            : ITEM_BREAKER_RESET_TIMEOUT_MS,
        rollingCountTimeout: ITEM_BREAKER_RESET_TIMEOUT_MS,
        errorFilter: (error: unknown) => this.isNonBreakerError(error),
      },
    );
    this.itemBreaker.on('open', () => this.logBreaker('open'));
    this.itemBreaker.on('halfOpen', () => this.logBreaker('half-open'));
    this.itemBreaker.on('close', () => this.logBreaker('closed'));
  }

  onModuleDestroy() {
    this.itemBreaker.shutdown();
  }

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
          kitchenNotified: false,
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
      await this.emitOrderCreated(order, lines, correlationId);
      this.logger.log('Event emitted to kitchen queue');
      try {
        await this.dbService.db
          .update(orders)
          .set({ kitchenNotified: true })
          .where(eq(orders.id, order.id));
      } catch (error) {
        this.logger.error(
          `Order ${order.id} notified kitchen but the sent flag update failed, reconciler will re-emit a duplicate`,
          error as Error,
        );
      }
    } catch (error) {
      this.logger.error(
        `Order ${order.id} saved but could not notify kitchen`,
        error as Error,
      );
    }

    return { success: true, orderId: order.id };
  }

  async emitOrderCreated(
    order: Order,
    lines: { menuItemId: string; itemName: string; quantity: number }[],
    correlationId: string,
  ) {
    await this.kitchenClient.emitOrderCreated(order, lines, correlationId);
  }

  async reconcileUnsentOrders(): Promise<number> {
    const unsent = await this.dbService.db
      .select()
      .from(orders)
      .where(
        and(eq(orders.status, 'pending'), eq(orders.kitchenNotified, false)),
      );

    let reemittedCount = 0;
    for (const row of unsent) {
      const { correlationId } = resolveCorrelationId(
        row.correlationId ?? undefined,
      );
      const reemitted = await correlationStorage.run(
        { correlationId },
        async () => {
          const lines = await this.dbService.db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, row.id));
          try {
            await this.emitOrderCreated(row, lines, correlationId);
          } catch (error) {
            this.logger.error(
              `Reconciler could not re-emit order ${row.id}`,
              error as Error,
            );
            return false;
          }
          const [updated] = await this.dbService.db
            .update(orders)
            .set({ kitchenNotified: true })
            .where(
              and(
                eq(orders.id, row.id),
                eq(orders.status, 'pending'),
                eq(orders.kitchenNotified, false),
              ),
            )
            .returning({ id: orders.id });
          if (updated) {
            this.logger.log(`Reconciler re-emitted order ${row.id}`);
            return true;
          }
          return false;
        },
      );
      if (reemitted) {
        reemittedCount += 1;
      }
    }
    return reemittedCount;
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
    if (
      current.status === 'needs_review' &&
      (status === 'cooking' || status === 'ready')
    ) {
      return current;
    }

    const [order] = await this.dbService.db
      .update(orders)
      .set(
        status === 'ready' && current.status !== 'ready'
          ? { status, readyAt: new Date() }
          : { status },
      )
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
    try {
      return await this.itemBreaker.fire(menuItemId);
    } catch (error) {
      if (this.isOpenCircuitError(error)) {
        throw new ServiceUnavailableException(
          'Item service is temporarily unavailable, please try again shortly',
        );
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (this.isTransientFetchError(error)) {
        throw new NotFoundException(
          `Menu item with ID ${menuItemId} not found`,
        );
      }
      throw error;
    }
  }

  private async fetchItemWithRetry(menuItemId: string): Promise<MenuItem> {
    const fallback = this.configService.get<string>(
      'ITEM_SERVICE_URL',
      'http://localhost:3001',
    );
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const baseUrl = await this.discovery.getServiceUrl(
        'item-service',
        fallback,
      );
      try {
        const response = await firstValueFrom(
          this.httpService
            .get<MenuItem>(`${baseUrl}/items/${menuItemId}`, {
              timeout: ITEM_FETCH_TIMEOUT_MS,
            })
            .pipe(timeout(ITEM_FETCH_TIMEOUT_MS)),
        );
        return response.data;
      } catch (error) {
        const record = error as { response?: unknown } | null | undefined;
        if (record && typeof record === 'object' && !record.response) {
          this.discovery.invalidate('item-service');
        }
        if (!this.isTransientFetchError(error)) {
          throw new NotFoundException(
            `Menu item with ID ${menuItemId} not found`,
          );
        }
        if (attempt === MAX_ATTEMPTS) {
          throw error;
        }
        this.logger.warn(
          `Retrying item-service fetch for item ${menuItemId}: attempt ${attempt} failed`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
    throw new NotFoundException(`Menu item with ID ${menuItemId} not found`);
  }

  private isOpenCircuitError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const record = error as { code?: unknown; message?: unknown };
    return (
      record.code === 'EOPENBREAKER' ||
      (typeof record.message === 'string' &&
        record.message.includes('Breaker is open'))
    );
  }

  private isNonBreakerError(error: unknown): boolean {
    if (error instanceof NotFoundException) {
      return true;
    }
    if (!error || typeof error !== 'object') {
      return false;
    }
    const record = error as { response?: { status?: unknown } };
    return (
      typeof record.response?.status === 'number' &&
      record.response.status >= 400 &&
      record.response.status < 500
    );
  }

  private logBreaker(state: string): void {
    const correlationId = correlationStorage.getStore()?.correlationId;
    const suffix = correlationId ? ` correlationId=${correlationId}` : '';
    this.logger.log(`item-service circuit ${state}${suffix}`);
  }

  private isTransientFetchError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const record = error as {
      response?: { status?: unknown };
      code?: unknown;
    };
    if (!record.response) {
      return true;
    }
    return (
      typeof record.response.status === 'number' &&
      record.response.status >= 500
    );
  }
}

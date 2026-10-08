import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  isRetryable,
  sleep,
} from '../rmq/rmq-retry';

interface RmqChannel {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
}

@Controller('orders')
@ApiBearerAuth()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard, ThrottlerGuard)
  @ApiOperation({ summary: 'Place an order for one menu item' })
  @ApiResponse({ status: 201, description: 'Order placed, returns orderId' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  @ApiResponse({
    status: 503,
    description: 'Item service temporarily unavailable (circuit open)',
  })
  @ApiResponse({ status: 429, description: 'Too many orders, retry later' })
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.ordersService.createOrder(dto, req.user?.userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List my orders, paginated (admin sees all)' })
  @ApiResponse({ status: 200, description: 'Order page with meta' })
  async listOrders(@Query() query: ListOrdersDto, @Req() req: any) {
    return this.ordersService.listOrders(
      req.user?.userId,
      req.user?.role,
      query.page ?? 1,
      query.limit ?? 10,
      query.status,
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get one order with its status' })
  @ApiResponse({ status: 200, description: 'The order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.ordersService.getOrder(id, req.user?.userId, req.user?.role);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Cancel a pending order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order is past pending' })
  async cancelOrder(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.ordersService.cancelOrder(id, req.user?.userId, req.user?.role);
  }

  @EventPattern('order_cooking')
  async handleOrderCooking(
    @Payload() data: { orderId: string; correlationId?: string },
    @Ctx() context: RmqContext,
  ) {
    await this.applyStatus(data, 'cooking', context);
  }

  @EventPattern('order_ready')
  async handleOrderReady(
    @Payload() data: { orderId: string; correlationId?: string },
    @Ctx() context: RmqContext,
  ) {
    await this.applyStatus(data, 'ready', context);
  }

  @EventPattern('order_dispatched')
  async handleOrderDispatched(
    @Payload() data: { orderId: string; correlationId?: string },
    @Ctx() context: RmqContext,
  ) {
    await this.applyStatus(data, 'dispatched', context);
  }

  @EventPattern('order_failed')
  async handleOrderFailed(
    @Payload() data: { orderId: string; correlationId?: string },
    @Ctx() context: RmqContext,
  ) {
    await this.applyStatus(data, 'cancelled', context);
  }

  private async applyStatus(
    data: { orderId: string; correlationId?: string },
    status: string,
    context: RmqContext,
  ) {
    const channel = context.getChannelRef() as RmqChannel;
    const message: unknown = context.getMessage();
    if (
      !data ||
      typeof data.orderId !== 'string' ||
      data.orderId.length === 0
    ) {
      this.logger.error(
        `orders rejected status event (${status}): payload missing orderId`,
      );
      channel.nack(message, false, false);
      return;
    }
    const { correlationId, minted } = resolveCorrelationId(data.correlationId);
    if (minted) {
      this.logger.warn(
        `No correlationId in status event for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await correlationStorage.run({ correlationId }, () =>
          this.ordersService.updateStatus(data.orderId, status),
        );
        channel.ack(message);
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
          this.logger.error(
            `orders rejected status event (${status}) for order ${data.orderId}: ${reason}`,
          );
          channel.nack(message, false, false);
          return;
        }
        this.logger.warn(
          `orders retrying status event (${status}) for order ${data.orderId}: attempt ${attempt} failed (${reason})`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';

@Controller('orders')
@ApiBearerAuth()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Place an order for one menu item' })
  @ApiResponse({ status: 201, description: 'Order placed, returns orderId' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.appService.createOrder(dto, req.user?.userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List my orders, paginated (admin sees all)' })
  @ApiResponse({ status: 200, description: 'Order page with meta' })
  async listOrders(@Query() query: ListOrdersDto, @Req() req: any) {
    return this.appService.listOrders(
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
    return this.appService.getOrder(id, req.user?.userId, req.user?.role);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Cancel a pending order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order is past pending' })
  async cancelOrder(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.appService.cancelOrder(id, req.user?.userId, req.user?.role);
  }

  @EventPattern('order_cooking')
  async handleOrderCooking(
    @Payload() data: { orderId: string; correlationId?: string },
  ) {
    await this.applyStatus(data, 'cooking');
  }

  @EventPattern('order_ready')
  async handleOrderReady(
    @Payload() data: { orderId: string; correlationId?: string },
  ) {
    await this.applyStatus(data, 'ready');
  }

  @EventPattern('order_dispatched')
  async handleOrderDispatched(
    @Payload() data: { orderId: string; correlationId?: string },
  ) {
    await this.applyStatus(data, 'dispatched');
  }

  @EventPattern('order_failed')
  async handleOrderFailed(
    @Payload() data: { orderId: string; correlationId?: string },
  ) {
    await this.applyStatus(data, 'cancelled');
  }

  private async applyStatus(
    data: { orderId: string; correlationId?: string },
    status: string,
  ) {
    const { correlationId, minted } = resolveCorrelationId(
      data.correlationId,
    );
    if (minted) {
      this.logger.warn(
        `No correlationId in status event for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    await correlationStorage.run({ correlationId }, () =>
      this.appService.updateStatus(data.orderId, status),
    );
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';

@Controller('orders')
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.appService.createOrder(dto, req.user?.userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  async listOrders(@Req() req: any) {
    return this.appService.listOrders(req.user?.userId, req.user?.role);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getOrder(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.appService.getOrder(id, req.user?.userId, req.user?.role);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard)
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

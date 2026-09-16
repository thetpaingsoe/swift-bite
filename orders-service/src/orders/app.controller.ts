import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.appService.createOrder(dto, req.user?.userId);
  }
}

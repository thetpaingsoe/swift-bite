import {
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { KitchenGuard } from '../auth/kitchen.guard';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import type { TicketLine } from '../db/schema';

interface OrderCreatedPayload {
  orderId: string;
  customerName: string;
  lines: TicketLine[];
  street: string;
  area: string;
  phone?: string | null;
  note?: string | null;
  correlationId?: string;
}

interface RmqChannel {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @EventPattern('order_created')
  async handleOrderCreated(
    @Payload() data: OrderCreatedPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as RmqChannel;
    const message: unknown = context.getMessage();
    const orderId =
      typeof data?.orderId === 'string' ? data.orderId : 'unknown';
    let compensation: { orderId: string; correlationId: string } | null = null;
    try {
      this.assertOrderCreatedPayload(data);
      const { correlationId, minted } = resolveCorrelationId(
        data.correlationId,
      );
      if (minted) {
        this.logger.warn(
          `No correlationId in order_created for order ${data.orderId}, minted ${correlationId}`,
        );
      }
      this.logger.log('kitchen received order: ' + data.orderId);

      compensation = { orderId: data.orderId, correlationId };
      await correlationStorage.run({ correlationId }, () =>
        this.appService.createTicket({ ...data, correlationId }),
      );
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `kitchen rejected order_created for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (compensation) {
        try {
          await this.appService.failTicket(
            compensation.orderId,
            compensation.correlationId,
          );
        } catch (compensationError) {
          this.logger.error(
            `kitchen could not compensate order ${compensation.orderId}: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`,
          );
        }
      }
      channel.nack(message, false, false);
    }
  }

  private assertOrderCreatedPayload(
    data: unknown,
  ): asserts data is OrderCreatedPayload {
    const payload = data as Partial<OrderCreatedPayload> | null | undefined;
    if (
      !payload ||
      typeof payload.orderId !== 'string' ||
      payload.orderId.length === 0
    ) {
      throw new Error('order_created payload missing orderId');
    }
    if (
      typeof payload.customerName !== 'string' ||
      payload.customerName.length === 0
    ) {
      throw new Error(
        `order_created payload missing customerName for order ${payload.orderId}`,
      );
    }
    if (!Array.isArray(payload.lines)) {
      throw new Error(
        `order_created payload missing lines for order ${payload.orderId}`,
      );
    }
    payload.lines.forEach((line, index) => {
      const entry = line as Partial<TicketLine> | null | undefined;
      if (
        !entry ||
        typeof entry.itemName !== 'string' ||
        entry.itemName.length === 0
      ) {
        throw new Error(
          `order_created payload has invalid itemName at lines[${index}] for order ${payload.orderId}`,
        );
      }
      if (
        typeof entry.quantity !== 'number' ||
        !Number.isFinite(entry.quantity) ||
        entry.quantity < 1
      ) {
        throw new Error(
          `order_created payload has invalid quantity at lines[${index}] for order ${payload.orderId}`,
        );
      }
    });
    if (typeof payload.street !== 'string' || payload.street.length === 0) {
      throw new Error(
        `order_created payload missing street for order ${payload.orderId}`,
      );
    }
    if (typeof payload.area !== 'string' || payload.area.length === 0) {
      throw new Error(
        `order_created payload missing area for order ${payload.orderId}`,
      );
    }
  }

  @Get('tickets')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tickets, optionally by status' })
  @ApiResponse({ status: 200, description: 'Ticket list, oldest first' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  @ApiResponse({ status: 403, description: 'Kitchen access required' })
  listTickets(@Query() query: ListTicketsDto) {
    return this.appService.listTickets(query.status);
  }

  @Get('tickets/:id')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one ticket' })
  @ApiResponse({ status: 200, description: 'The ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  getTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.getTicket(id);
  }

  @Patch('tickets/:id/accept')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a ticket, moves it to cooking' })
  @ApiResponse({ status: 200, description: 'Ticket cooking' })
  @ApiResponse({ status: 409, description: 'Ticket is not received' })
  acceptTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.acceptTicket(id);
  }

  @Patch('tickets/:id/complete')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a ticket, moves it to ready and notifies rider' })
  @ApiResponse({ status: 200, description: 'Ticket ready' })
  @ApiResponse({ status: 409, description: 'Ticket is not cooking' })
  completeTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.completeTicket(id);
  }

  @Patch('tickets/:id/reject')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a ticket, cancels the order' })
  @ApiResponse({ status: 200, description: 'Ticket rejected' })
  @ApiResponse({ status: 409, description: 'Ticket is already ready' })
  rejectTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.rejectTicket(id);
  }
}

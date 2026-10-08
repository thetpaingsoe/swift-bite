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
import { TicketsService } from './tickets.service';
import { KitchenGuard } from '../auth/kitchen.guard';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import type { TicketLine } from '../db/schema';
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  isRetryable,
  sleep,
} from '../rmq/rmq-retry';

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
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  @EventPattern('order_created')
  async handleOrderCreated(
    @Payload() data: OrderCreatedPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as RmqChannel;
    const message: unknown = context.getMessage();
    const orderId =
      typeof data?.orderId === 'string' ? data.orderId : 'unknown';
    try {
      this.assertOrderCreatedPayload(data);
    } catch (error) {
      this.logger.error(
        `kitchen rejected order_created for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      channel.nack(message, false, false);
      return;
    }
    const { correlationId, minted } = resolveCorrelationId(data.correlationId);
    if (minted) {
      this.logger.warn(
        `No correlationId in order_created for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    this.logger.log('kitchen received order: ' + data.orderId);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await correlationStorage.run({ correlationId }, () =>
          this.ticketsService.createTicket({ ...data, correlationId }),
        );
        channel.ack(message);
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
          this.logger.error(
            `kitchen rejected order_created for order ${orderId}: ${reason}`,
          );
          try {
            await this.ticketsService.failTicket(data.orderId, correlationId);
          } catch (compensationError) {
            this.logger.error(
              `kitchen could not compensate order ${data.orderId}: ${compensationError instanceof Error ? compensationError.message : String(compensationError)}`,
            );
          }
          channel.nack(message, false, false);
          return;
        }
        this.logger.warn(
          `kitchen retrying order_created for order ${orderId}: attempt ${attempt} failed (${reason})`,
        );
        await sleep(RETRY_DELAY_MS);
      }
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
    return this.ticketsService.listTickets(query.status);
  }

  @Get('tickets/:id')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one ticket' })
  @ApiResponse({ status: 200, description: 'The ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  getTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.getTicket(id);
  }

  @Patch('tickets/:id/accept')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a ticket, moves it to cooking' })
  @ApiResponse({ status: 200, description: 'Ticket cooking' })
  @ApiResponse({ status: 409, description: 'Ticket is not received' })
  acceptTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.acceptTicket(id);
  }

  @Patch('tickets/:id/complete')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a ticket, moves it to ready and notifies rider' })
  @ApiResponse({ status: 200, description: 'Ticket ready' })
  @ApiResponse({ status: 409, description: 'Ticket is not cooking' })
  completeTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.completeTicket(id);
  }

  @Patch('tickets/:id/reject')
  @UseGuards(KitchenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a ticket, cancels the order' })
  @ApiResponse({ status: 200, description: 'Ticket rejected' })
  @ApiResponse({ status: 409, description: 'Ticket is already ready' })
  rejectTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.rejectTicket(id);
  }
}

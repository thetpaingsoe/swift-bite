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
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import type { TicketLine } from '../db/schema';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @EventPattern('order_created')
  async handleOrderCreated(
    @Payload()
    data: {
      orderId: string;
      customerName: string;
      lines: TicketLine[];
      street: string;
      area: string;
      correlationId?: string;
    },
  ) {
    const { correlationId, minted } = resolveCorrelationId(
      data.correlationId,
    );
    if (minted) {
      this.logger.warn(
        `No correlationId in order_created for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    this.logger.log('kitchen received order: ' + data.orderId);

    await correlationStorage.run({ correlationId }, () =>
      this.appService.createTicket({ ...data, correlationId }),
    );
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

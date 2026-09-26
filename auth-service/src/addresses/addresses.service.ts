import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { addresses } from '../db/schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(private readonly dbService: DbService) {}

  async listAddresses(userId: string) {
    return this.dbService.db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(asc(addresses.createdAt));
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    try {
      const [created] = await this.dbService.db
        .insert(addresses)
        .values({ ...dto, userId })
        .returning();
      return created;
    } catch (error) {
      this.logger.error('Failed to persist address', error as Error);
      throw new BadGatewayException('Could not save the address');
    }
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    let updated;
    try {
      [updated] = await this.dbService.db
        .update(addresses)
        .set(dto)
        .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
        .returning();
    } catch (error) {
      this.logger.error('Failed to update address', error as Error);
      throw new BadGatewayException('Could not update the address');
    }

    if (!updated) {
      throw new NotFoundException('Address not found');
    }
    return updated;
  }

  async removeAddress(userId: string, id: string) {
    let removed;
    try {
      [removed] = await this.dbService.db
        .delete(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
        .returning();
    } catch (error) {
      this.logger.error('Failed to delete address', error as Error);
      throw new BadGatewayException('Could not delete the address');
    }

    if (!removed) {
      throw new NotFoundException('Address not found');
    }
    return { success: true };
  }
}

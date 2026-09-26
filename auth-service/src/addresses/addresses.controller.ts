import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { AuthService } from '../auth/auth.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
@ApiBearerAuth()
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my saved addresses' })
  @ApiResponse({ status: 200, description: 'Address list, oldest first' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async listAddresses(@Headers('authorization') authorization: string) {
    const { userId } = await this.requireUserId(authorization);
    return this.addressesService.listAddresses(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new address' })
  @ApiResponse({ status: 201, description: 'Address saved' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async createAddress(
    @Headers('authorization') authorization: string,
    @Body() dto: CreateAddressDto,
  ) {
    const { userId } = await this.requireUserId(authorization);
    return this.addressesService.createAddress(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one of my addresses' })
  @ApiResponse({ status: 200, description: 'Address updated' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async updateAddress(
    @Headers('authorization') authorization: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const { userId } = await this.requireUserId(authorization);
    return this.addressesService.updateAddress(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of my addresses' })
  @ApiResponse({ status: 200, description: 'Address deleted' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async removeAddress(
    @Headers('authorization') authorization: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { userId } = await this.requireUserId(authorization);
    return this.addressesService.removeAddress(userId, id);
  }

  private async requireUserId(
    authorization: string,
  ): Promise<{ userId: string }> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }
    const token = authorization.slice(7);
    const claims = (await this.authService.verifyToken(token)) as {
      userId: string;
    };
    return { userId: claims.userId };
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @ApiProperty({ example: '48c654f1-1317-48bc-98ad-e0ea20263c1c' })
  @IsUUID()
  menuItemId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  customerName!: string;

  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  street!: string;

  @ApiProperty({ example: 'Downtown' })
  @IsString()
  area!: string;

  @ApiProperty({ example: '+959123456789' })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional({ example: 'Leave at the door' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

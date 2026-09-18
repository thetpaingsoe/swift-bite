import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  customerName!: string;

  @ApiProperty({ example: '48c654f1-1317-48bc-98ad-e0ea20263c1c' })
  @IsUUID()
  menuItemId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  street!: string;

  @ApiProperty({ example: 'Downtown' })
  @IsString()
  area!: string;
}

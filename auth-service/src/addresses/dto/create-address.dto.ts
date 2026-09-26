import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label!: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  street!: string;

  @ApiProperty({ example: 'Downtown' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  area!: string;
}

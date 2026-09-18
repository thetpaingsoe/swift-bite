import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsUUID,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'Cheeseburger' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'Juicy beef patty with cheddar' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: 899 })
  @IsNumber()
  @Min(1)
  price!: number;

  @ApiProperty({ example: '650874b9-d225-4b73-8cce-873f90aca670' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'https://example.com/burger.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  imageUrl!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

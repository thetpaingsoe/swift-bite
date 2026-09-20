import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListTicketsDto {
  @ApiPropertyOptional({ example: 'received' })
  @IsOptional()
  @IsString()
  @IsIn(['received', 'cooking', 'ready', 'rejected'])
  status?: string;
}

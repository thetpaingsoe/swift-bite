import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'customer@swiftbite.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Customer123!' })
  @IsString()
  password!: string;
}

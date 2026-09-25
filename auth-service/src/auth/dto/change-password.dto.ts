import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password1!' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    example: 'NewPassword2@',
    description: 'Min 8 chars with 1 uppercase, 1 number, 1 special char',
  })
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Z]/, {
    message: 'password must contain at least 1 uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'password must contain at least 1 special character',
  })
  newPassword!: string;
}

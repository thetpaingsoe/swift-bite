import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created, returns JWT' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 201, description: 'Returns user and JWT' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a JWT and read its claims' })
  @ApiResponse({
    status: 200,
    description: 'Token valid, returns userId and role',
  })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  verify(@Headers('authorization') authorization: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }
    const token = authorization.slice(7);
    return this.authService.verifyToken(token);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my display name' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async updateProfile(
    @Headers('authorization') authorization: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const { userId } = await this.requireUserId(authorization);
    return this.authService.updateProfile(userId, dto.name, dto.phone);
  }

  @Patch('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change my password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({
    status: 401,
    description: 'Invalid token or wrong current password',
  })
  async changePassword(
    @Headers('authorization') authorization: string,
    @Body() dto: ChangePasswordDto,
  ) {
    const { userId } = await this.requireUserId(authorization);
    return this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
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

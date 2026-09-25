import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let created;
    try {
      [created] = await this.dbService.db
        .insert(users)
        .values({
          name: dto.name,
          email: dto.email,
          passwordHash,
        })
        .returning();
    } catch (error) {
      this.logger.error('Failed to persist user', error as Error);
      throw new BadGatewayException('Could not create the account');
    }

    const token = this.signToken(created.id, created.email, created.role);

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      token,
    };
  }

  async login(dto: LoginDto) {
    const [user] = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signToken(user.id, user.email, user.role);

    this.logger.log('Logged In', user.name);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    };
  }

  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return { userId: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async updateProfile(userId: string, name: string) {
    let updated;
    try {
      [updated] = await this.dbService.db
        .update(users)
        .set({ name })
        .where(eq(users.id, userId))
        .returning();
    } catch (error) {
      this.logger.error('Failed to update profile', error as Error);
      throw new BadGatewayException('Could not update the profile');
    }

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const [user] = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!currentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    try {
      await this.dbService.db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, userId));
    } catch (error) {
      this.logger.error('Failed to change password', error as Error);
      throw new BadGatewayException('Could not change the password');
    }

    return { success: true };
  }

  private signToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, email, role },
      {
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRES_IN',
          '7d',
        ) as any,
      },
    );
  }
}

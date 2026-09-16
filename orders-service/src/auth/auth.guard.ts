import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers['authorization'];

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }

    const token = authorization.slice(7);
    const authServiceUrl = this.configService.get<string>(
      'AUTH_SERVICE_URL',
      'http://localhost:3000',
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${authServiceUrl}/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      request.user = response.data;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

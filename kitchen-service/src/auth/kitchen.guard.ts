import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KitchenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

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
      const response = await fetch(`${authServiceUrl}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`verify responded ${response.status}`);
      }
      request.user = await response.json();
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (request.user?.role !== 'kitchen' && request.user?.role !== 'admin') {
      throw new ForbiddenException('Kitchen access required');
    }

    return true;
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AddressesModule } from './addresses/addresses.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AuthModule, AddressesModule, HealthModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { NeonHealthIndicator } from './neon.health';
import { RmqHealthIndicator } from './rmq.health';
import { DbService } from '../db/db.service';
import { ConfigModule } from '@nestjs/config';
import { KitchenClientModule } from '../kitchen-client/kitchen-client.module';

@Module({
  imports: [TerminusModule, ConfigModule, KitchenClientModule],
  controllers: [HealthController],
  providers: [NeonHealthIndicator, RmqHealthIndicator, DbService],
})
export class HealthModule {}

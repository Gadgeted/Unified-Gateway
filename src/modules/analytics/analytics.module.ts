import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { MerchantSettingsController } from './merchant-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, MerchantSettingsController],
  providers: [
    AnalyticsService,
    HybridAuthGuard,  // ✅ If used here
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
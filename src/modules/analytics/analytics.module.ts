import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { MerchantSettingsController } from './merchant-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_gateway_key_for_development_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AnalyticsController, MerchantSettingsController],
  providers: [
    AnalyticsService,
    HybridAuthGuard,   // ✅ now JwtService is available
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
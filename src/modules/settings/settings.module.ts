import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
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
  controllers: [SettingsController],
  providers: [
    SettingsService,
    HybridAuthGuard,  // ✅ provides JwtService via JwtModule
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
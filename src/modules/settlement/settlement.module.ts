import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_gateway_key_for_development_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    HybridAuthGuard,   // ✅ now JwtService is available
  ],
  exports: [SettlementService],
})
export class SettlementModule {}
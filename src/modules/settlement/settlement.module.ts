import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Module({
  controllers: [SettlementController],
  providers: [
    SettlementService,
    HybridAuthGuard,  // ✅ If used here
  ],
  exports: [SettlementService],
})
export class SettlementModule {}
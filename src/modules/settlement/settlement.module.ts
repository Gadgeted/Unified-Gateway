import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { MpesaModule } from '../mpesa/mpesa.module'; // ✅ import MpesaModule
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Module({
  imports: [
    MpesaModule, // ✅ makes B2cService available
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    HybridAuthGuard,
  ],
  exports: [SettlementService],
})
export class SettlementModule {}
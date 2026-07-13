import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { MpesaModule } from '../mpesa/mpesa.module';
import { AirtelModule } from '../airtel/airtel.module';
import { CardModule } from '../cards/cards.module';
import { CryptoModule } from '../crypto/crypto.module';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Module({
  imports: [
    MpesaModule,
    AirtelModule,
    CardModule,
    CryptoModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_gateway_key_for_development_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    HybridAuthGuard,  // ✅ MUST BE HERE, NOT IN IMPORTS
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
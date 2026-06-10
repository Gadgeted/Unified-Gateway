import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { MpesaModule } from '../mpesa/mpesa.module'; // ◄ Import the M-Pesa module
import { AirtelModule } from '../airtel/airtel.module'; // ◄ Import Airtel Module
import { CardModule } from '../cards/cards.module'; // ◄ Import Card Module
import { CryptoModule } from '../crypto/crypto.module'; // ◄ Import Crypto Module

@Module({
  imports: [
    MpesaModule,  // ◄  MpesaModule to imports list
    AirtelModule, // ◄  AirtelModule 
    CardModule,   // ◄  CardModule
    CryptoModule // ◄  CryptoModule here
  ], 
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
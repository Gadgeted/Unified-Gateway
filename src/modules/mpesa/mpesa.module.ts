import { Module } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller'; // ◄ Import the new controller

@Module({
  controllers: [MpesaController], // ◄ Register the controller here
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
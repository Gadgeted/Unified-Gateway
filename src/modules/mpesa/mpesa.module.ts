// src/modules/mpesa/mpesa.module.ts
import { Module } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { B2cService } from './b2c.service';

@Module({
  controllers: [MpesaController],
  providers: [MpesaService, B2cService],
  exports: [MpesaService, B2cService],
})
export class MpesaModule {}
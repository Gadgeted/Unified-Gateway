import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Module({
  providers: [CryptoService],
  exports: [CryptoService], // ◄ Export it for the central transaction router
})
export class CryptoModule {}
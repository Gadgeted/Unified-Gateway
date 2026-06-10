import { Module } from '@nestjs/common';
import { CardService } from './card.service';

@Module({
  providers: [CardService],
  exports: [CardService], // ◄ Export it for the central transaction router
})
export class CardModule {}
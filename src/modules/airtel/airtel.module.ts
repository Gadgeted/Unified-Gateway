import { Module } from '@nestjs/common';
import { AirtelService } from './airtel.service';

@Module({
  providers: [AirtelService],
  exports: [AirtelService], // ◄ Export it so our transaction router can see it
})
export class AirtelModule {}
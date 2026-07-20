import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MpesaModule } from './modules/mpesa/mpesa.module';
import { AirtelModule } from './modules/airtel/airtel.module';
import { CardModule } from './modules/cards/cards.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AuthModule } from './modules/auth/auth.module'; // <-- ADD
import { PrismaService } from './modules/prisma/prisma.service';
import { TicketsModule } from './modules/tickets/tickets.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    MpesaModule,
    AirtelModule,
    CardModule,
    CryptoModule,
    InventoryModule,
    TransactionsModule,
    PrismaModule,
    AnalyticsModule,
    SettlementModule,
    AuthModule,
    TicketsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    console.log('🌱 Application booting up: Checking seed requirements...');
    try {
      const merchant = await this.prisma.merchant.upsert({
        where: { apiKey: 'tg_live_secret_key_abc123' },
        update: {},
        create: {
          id: 'test-merchant-uuid-1234',
          businessName: 'Maina Electronics & Spares',
          email: 'test@mainaelectronics.com',
          apiKey: 'tg_live_secret_key_abc123',
          mpesaFeePercent: 1.5,
          airtelFeePercent: 1.5,
          cardFeePercent: 2.9,
          cryptoFeePercent: 1.0,
        },
      });
      console.log('✅ Success! Test merchant is ready inside the database.');
    } catch (error: any) {
      console.error('❌ Direct initialization seed failed:', error.message);
    }
  }
}
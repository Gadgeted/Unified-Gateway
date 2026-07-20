import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getGlobalFeeSettings() {
    const keys = ['mpesa_fee', 'airtel_fee', 'card_fee', 'crypto_fee'];
    const records = await this.prisma.globalSetting.findMany({
      where: { key: { in: keys } },
    });
    const map: Record<string, number> = {};
    for (const rec of records) {
      map[rec.key] = parseFloat(rec.value);
    }
    return {
      mpesa: map['mpesa_fee'] ?? 1.5,
      airtel: map['airtel_fee'] ?? 1.5,
      card: map['card_fee'] ?? 2.9,
      crypto: map['crypto_fee'] ?? 1.0,
    };
  }

  async updateGlobalFeeSettings(fees: { mpesa: number; airtel: number; card: number; crypto: number }) {
    const data = [
      { key: 'mpesa_fee', value: String(fees.mpesa) },
      { key: 'airtel_fee', value: String(fees.airtel) },
      { key: 'card_fee', value: String(fees.card) },
      { key: 'crypto_fee', value: String(fees.crypto) },
    ];
    for (const item of data) {
      await this.prisma.globalSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      });
    }
    return this.getGlobalFeeSettings();
  }
}
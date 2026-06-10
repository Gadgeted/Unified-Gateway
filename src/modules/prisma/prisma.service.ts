import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private static getDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Environment variable DATABASE_URL is required to initialize Prisma.');
    }
    return databaseUrl;
  }

  public readonly client = new PrismaClient({
    adapter: new PrismaPg(PrismaService.getDatabaseUrl()),
  });

  // Pass-through getters so your controllers and services don't break
  get merchant() { return this.client.merchant; }
  get transaction() { return this.client.transaction; }
  get inventory() { return this.client.inventory; }
  get expense() { return this.client.expense; }
  get salary() { return this.client.salary; }
  get payout() { return this.client.payout; }

  async onModuleInit() {
    await this.client.$connect();
    console.log('🔗 Database connected successfully to PostgreSQL.');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
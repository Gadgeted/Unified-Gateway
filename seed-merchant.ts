import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Environment variable DATABASE_URL is required for seeding.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

async function main() {
  console.log('🌱 Starting database seeding sequence...');
  
  const merchant = await prisma.merchant.upsert({
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

  console.log('✅ Success! Test merchant injected into PostgreSQL database:', merchant);
}

main()
  .catch((e) => {
    console.error('❌ Seeding execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
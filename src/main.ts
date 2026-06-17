import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- ADD THIS LINE TO FIX THE FRONTEND CROSS-ORIGIN ERROR ---
  app.enableCors({
    origin: [
      'http://localhost:3001', //  Unified Pay Frontend Dashboard
      'http://localhost:5173', //  Smart SME POS System Application
      // Add more origins as needed
    ], // Allows your Next.js app to connect
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, x-api-key', // Explicitly allow your custom API key header
  });

  await app.listen(3000);
  console.log('🚀 Unified Gateway API running on http://localhost:3000');
}
bootstrap();
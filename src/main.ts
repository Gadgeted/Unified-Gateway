// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // --- ADD THIS LINE TO FIX THE FRONTEND CROSS-ORIGIN ERROR ---
//   app.enableCors({
//     origin: [
//       'http://localhost:3001', //  Unified Pay Frontend Dashboard
//       'http://localhost:5173', //  Smart SME POS System Application
//       // Add more origins as needed
//     ], // Allows your Next.js app to connect
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
//     credentials: true,
//     allowedHeaders: 'Content-Type, Accept, Authorization, x-api-key', // Explicitly allow your custom API key header
//   });

//   // await app.listen(3000);
//   const port = process.env.PORT || 3000;
//   await app.listen(port, '0.0.0.0');
//   console.log(`🚀 Unified Gateway API running on http://localhost:${port}`);
// }
// bootstrap();


import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- GLOBAL CORS CONFIGURATION FOR TEAM COLLABORATION ---
  app.enableCors({
    // The asterisk '*' allows your friends' local POS apps to connect to your cloud API cleanly
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    // Must be false when using origin '*' to prevent browser-level handshake blocks
    credentials: false, 
    // Explicitly allow headers used by your frontend dashboard and checkout gateway
    allowedHeaders: 'Content-Type, Accept, Authorization, x-api-key', 
  });

  // Dynamically binds to Render's environment port or defaults to 3000 locally
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Unified Gateway API running globally on port ${port}`);
}
bootstrap();
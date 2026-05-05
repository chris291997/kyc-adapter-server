import * as dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // Disable NestJS default body parser (which has 100KB limit) and configure our own with higher limit
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable default body parser
  });

  // Serve static files from public/uploads directory
  // Files in public/uploads/verifications/{id}/ are accessible at /uploads/verifications/{id}/
  app.useStaticAssets(join(process.cwd(), 'public', 'uploads'), {
    prefix: '/uploads',
    index: false,
  });

  // Configure body parser to handle large base64-encoded images (10MB limit)
  // Base64 encoding increases image size by ~33%, so a 10MB limit can handle images up to ~7.5MB
  // A 349KB image becomes ~465KB when base64 encoded, so 10MB provides plenty of headroom
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS configuration
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (!corsOrigins || corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS env is required (no localhost fallback)');
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('KYC Adapter API')
    .setDescription('Provider-agnostic KYC verification system')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`KYC Adapter API running on http://localhost:${port}`);
  logger.log(`API documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();


import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  // app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    credentials: true,
    origin: ['http://localhost:3001', 'http://localhost:3002'],
    allowedHeaders: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.setGlobalPrefix('api', { exclude: ['auth/(.*)'] });
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

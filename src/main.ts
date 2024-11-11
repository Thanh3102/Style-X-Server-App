import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  // app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    credentials: true,
    origin: '*',
    allowedHeaders: '*',
  });
  app.setGlobalPrefix('api', { exclude: ['auth/(.*)'] });
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

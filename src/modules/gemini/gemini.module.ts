import { Module } from '@nestjs/common';
import { GeminiController } from './gemini.controller';
import { GeminiService } from './gemini.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Module({
  controllers: [GeminiController],
  providers: [GeminiService, CloudinaryService],
})
export class GeminiModule {}

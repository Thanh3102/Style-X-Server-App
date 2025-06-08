import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('gemini')
export class GeminiController {
  constructor(private geminiService: GeminiService) {}

  @Post('/generate')
  generate(@Body() body: { contents: string }) {
    return this.geminiService.generate(body.contents);
  }

  @Post('/generate-image-preview')
  @UseInterceptors(FileInterceptor('image'))
  generateImagePreview(@UploadedFile() image: Express.Multer.File) {
    return this.geminiService.generateImagePreview(image);
  }
}

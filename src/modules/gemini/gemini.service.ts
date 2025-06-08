import { Injectable } from '@nestjs/common';
import {
  createPartFromUri,
  createUserContent,
  GoogleGenAI,
} from '@google/genai';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class GeminiService {
  constructor(private cloudinary: CloudinaryService) {}

  private ai = new GoogleGenAI({
    apiKey: 'AIzaSyCAIZi4D_tlp2_Q0pIKfkj_XJyZ5xqBwWA',
  });

  async generate(contents: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contents,
      });
      console.log('>>> AI Response', response.text);
      return response.text;
    } catch (error) {
      console.log(error);
      return `Error generating content`;
    }
  }

  async generateImagePreview(image: Express.Multer.File): Promise<string> {
    try {
      //   const cloudinaryResponse = await this.cloudinary.uploadFile(image, {
      //     folder: "Gemini Preview Images",
      //     public_id: Date.now().toString(),
      //   })

      const base64ImageData = Buffer.from(image.buffer).toString('base64');

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64ImageData,
            },
          },
          { text: 'Tạo một tiêu đề cho bức ảnh này. Chỉ đặt tiêu đề không trả lời gì khác' },
        ],
      });
      console.log(result.text);
      return result.text;
    } catch (error) {
      console.log(error);
      return `Error generating image preview`;
    }
  }
}

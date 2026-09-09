import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY_CLIENT = Symbol('CLOUDINARY_CLIENT');

export const CloudinaryProvider = {
  provide: CLOUDINARY_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    return cloudinary;
  },
};

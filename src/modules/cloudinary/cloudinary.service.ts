// cloudinary.service.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { UploadApiOptions, v2 as cloudinary } from 'cloudinary';
import { CloudinaryResponse } from './cloudinary.type';
import * as streamifier from 'streamifier';
import { CLOUDINARY_CLIENT } from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly client: typeof cloudinary
  ) {}

  uploadFile(
    file: Express.Multer.File,
    options?: UploadApiOptions
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = this.client.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await this.client.uploader.destroy(publicId);
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete Cloudinary asset ${publicId}`, stack);
    }
  }
}

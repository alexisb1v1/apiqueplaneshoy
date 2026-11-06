import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'qph-media-dev';
    this.publicUrl = (
      this.configService.get<string>('R2_PUBLIC_URL') || 'https://pub-r2.dev'
    ).replace(/\/$/, '');

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'Las credenciales de Cloudflare R2 no están configuradas completamente en el archivo .env.'
      );
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  async getPresignedUploadUrl(
    dto: GetPresignedUrlDto
  ): Promise<PresignedUrlResponseDto> {
    const folder = (dto.folder || 'banners').replace(/^\/+|\/+$/g, '');
    const extension = this.extractExtension(dto.filename, dto.contentType);
    const uniqueId = randomUUID();
    const timestamp = Date.now();
    const key = `${folder}/${timestamp}-${uniqueId}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: dto.contentType,
    });

    // Generar URL prefirmada válida por 300 segundos (5 minutos)
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 300,
    });

    const publicUrl = `${this.publicUrl}/${key}`;

    this.logger.log(`URL prefirmada generada con éxito para objeto: ${key}`);

    return {
      uploadUrl,
      publicUrl,
      key,
    };
  }

  private extractExtension(filename: string, contentType: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      const ext = parts.pop()?.toLowerCase();
      if (ext && ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }

    // Fallback por tipo MIME
    switch (contentType) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/svg+xml':
        return 'svg';
      case 'image/jpeg':
      default:
        return 'jpg';
    }
  }
}


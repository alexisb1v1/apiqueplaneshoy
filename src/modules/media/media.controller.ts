import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar URL prefirmada para subida directa de imágenes a Cloudflare R2',
    description:
      'Devuelve una URL prefirmada temporal de 5 minutos para subir el archivo vía PUT directo a Cloudflare R2 y la URL pública CDN resultante.',
  })
  @ApiResponse({
    status: 200,
    description: 'URL prefirmada generada exitosamente.',
    type: PresignedUrlResponseDto,
  })
  async getPresignedUrl(
    @Body() dto: GetPresignedUrlDto
  ): Promise<PresignedUrlResponseDto> {
    return this.mediaService.getPresignedUploadUrl(dto);
  }
}


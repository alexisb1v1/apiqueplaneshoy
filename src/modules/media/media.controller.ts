import {
  Controller,
  Post,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';
import { DeleteMediaRequestDto } from './dto/delete-media.request.dto';
import { DeleteMediaQueryDto } from './dto/delete-media.query.dto';
import { DeleteMediaResponseDto } from './dto/delete-media.response.dto';

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

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar imagen de Cloudflare R2',
    description:
      'Elimina un recurso multimedia previamente cargado a Cloudflare R2 mediante su URL pública o clave relativa (soportado vía query param ?url= o body { keyOrUrl }).',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la operación de eliminación.',
    type: DeleteMediaResponseDto,
  })
  async deleteMedia(
    @Query() queryDto?: DeleteMediaQueryDto,
    @Body() bodyDto?: DeleteMediaRequestDto
  ): Promise<DeleteMediaResponseDto> {
    const targetKeyOrUrl = queryDto?.url || bodyDto?.keyOrUrl;
    if (!targetKeyOrUrl || typeof targetKeyOrUrl !== 'string' || !targetKeyOrUrl.trim()) {
      throw new BadRequestException(
        'Debe proporcionar la URL o clave del archivo a eliminar en query param (?url=...) o en el body ({ keyOrUrl: "..." }).'
      );
    }
    return this.mediaService.deleteMediaObject(targetKeyOrUrl.trim());
  }
}

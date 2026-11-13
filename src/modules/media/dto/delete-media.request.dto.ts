import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteMediaRequestDto {
  @ApiPropertyOptional({
    description: 'URL pública o clave relativa del archivo en Cloudflare R2 a eliminar',
    example: 'banners/1730328900-uuid.webp',
  })
  @IsOptional()
  @IsString({ message: 'El parámetro keyOrUrl debe ser una cadena de texto válida.' })
  readonly keyOrUrl?: string;
}

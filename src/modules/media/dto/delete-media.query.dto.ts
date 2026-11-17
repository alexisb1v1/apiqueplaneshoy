import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteMediaQueryDto {
  @ApiPropertyOptional({
    description: 'URL pública o ruta relativa del objeto en Cloudflare R2 a eliminar',
    example: 'https://pub-a0e3dd95ab1248508e25dda25a178cd6.r2.dev/landings/1730328900-uuid.webp',
  })
  @IsOptional()
  @IsString({ message: 'El parámetro url debe ser una cadena de texto válida.' })
  readonly url?: string;
}


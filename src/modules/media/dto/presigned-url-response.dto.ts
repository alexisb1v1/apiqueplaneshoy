import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({
    description: 'URL prefirmada temporal para subir directamente el archivo con método PUT',
    example: 'https://8061ae401fcc20d04bb58176a0deafc3.r2.cloudflarestorage.com/qph-media-dev/banners/abc.png?...',
  })
  readonly uploadUrl: string;

  @ApiProperty({
    description: 'URL pública permanente y CDN para visualizar la imagen',
    example: 'https://pub-8061ae401fcc20d04bb58176a0deafc3.r2.dev/banners/1730328900-uuid.webp',
  })
  readonly publicUrl: string;

  @ApiProperty({
    description: 'Clave o ruta relativa del objeto dentro del bucket R2',
    example: 'banners/1730328900-uuid.webp',
  })
  readonly key: string;
}


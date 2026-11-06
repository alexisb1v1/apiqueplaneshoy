import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class GetPresignedUrlDto {
  @ApiProperty({
    description: 'Nombre del archivo original',
    example: 'banner-principal.png',
  })
  @IsString()
  @IsNotEmpty()
  readonly filename: string;

  @ApiProperty({
    description: 'Tipo MIME del archivo',
    example: 'image/png',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^image\/(jpeg|jpg|png|webp|svg\+xml)$/, {
    message: 'Formato de imagen no permitido. Solo se permiten JPEG, PNG, WebP o SVG.',
  })
  readonly contentType: string;

  @ApiProperty({
    description: 'Carpeta o sección donde se almacenará el recurso',
    example: 'banners',
    required: false,
    enum: ['banners', 'croquis', 'gallery', 'landings', 'organizers'],
  })
  @IsString()
  @IsOptional()
  readonly folder?: string = 'banners';
}


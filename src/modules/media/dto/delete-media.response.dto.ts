import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class DeleteMediaResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Indica si el archivo fue eliminado de Cloudflare R2 con éxito',
    example: true,
  })
  readonly success: boolean;

  @Expose()
  @ApiProperty({
    description: 'Clave o ruta relativa del objeto eliminado',
    example: 'banners/1730328900-uuid.webp',
  })
  readonly key: string;

  constructor(partial: Partial<DeleteMediaResponseDto>) {
    Object.assign(this, partial);
  }
}


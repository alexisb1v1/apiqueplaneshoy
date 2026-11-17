import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ToggleFavoriteResponseDto {
  @ApiProperty({ example: true, description: 'Estado actual: true si está marcado como favorito, false si fue retirado' })
  @Expose()
  isFavorite: boolean;

  @ApiProperty({ example: '12', description: 'ID numérico interno del evento' })
  @Expose()
  eventId: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'UUID público del evento' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ example: 'Evento agregado a favoritos', description: 'Mensaje descriptivo del resultado' })
  @Expose()
  message: string;

  constructor(isFavorite: boolean, eventId: string, publicUuid: string, message: string) {
    this.isFavorite = isFavorite;
    this.eventId = eventId;
    this.publicUuid = publicUuid;
    this.message = message;
  }
}


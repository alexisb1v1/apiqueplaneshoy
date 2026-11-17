import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserFavoriteIdsResponseDto {
  @ApiProperty({
    example: ['1', '2', '5'],
    description: 'Lista de IDs numéricos de eventos marcados como favoritos',
    type: [String],
  })
  @Expose()
  favoriteIds: string[];

  @ApiProperty({
    example: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    description: 'Lista de publicUuids de eventos marcados como favoritos',
    type: [String],
  })
  @Expose()
  favoritePublicUuids: string[];

  constructor(favoriteIds: string[], favoritePublicUuids: string[]) {
    this.favoriteIds = favoriteIds;
    this.favoritePublicUuids = favoritePublicUuids;
  }
}


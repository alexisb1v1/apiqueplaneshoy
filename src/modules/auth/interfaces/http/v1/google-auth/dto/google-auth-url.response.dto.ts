import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class GoogleAuthUrlResponseDto {
  @ApiProperty({
    example: 'https://accounts.google.com/o/oauth2/v2/auth?...',
    description: 'URL oficial de consentimiento OAuth 2.0 de Google',
  })
  @Expose()
  url: string;
}


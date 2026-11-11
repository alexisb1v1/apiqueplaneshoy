import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class GoogleAuthUserDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Alexis Bermúdez' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'Alexis' })
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'Bermúdez' })
  @Expose()
  lastName: string;

  @ApiProperty({ example: 'alexis@queplaneshoy.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: '+51 987654321', required: false, nullable: true })
  @Expose()
  phone?: string | null;

  @ApiProperty({ example: 'customer' })
  @Expose()
  role: string;

  @ApiProperty({ example: false })
  @Expose()
  isOrganizer: boolean;

  @ApiProperty({ example: 'Productora Musical SAC', required: false, nullable: true })
  @Expose()
  organizerName?: string | null;

  @ApiProperty({ example: 'RUC', required: false, nullable: true })
  @Expose()
  organizerDocumentType?: string | null;

  @ApiProperty({ example: '20123456789', required: false, nullable: true })
  @Expose()
  organizerDocumentNumber?: string | null;

  @ApiProperty({ example: 'https://cdn.queplaneshoy.com/logos/org.png', required: false, nullable: true })
  @Expose()
  organizerLogoUrl?: string | null;

  @ApiProperty({ example: '2026-10-22T17:30:00.000Z', nullable: true })
  @Expose()
  emailVerifiedAt: Date | null;

  @ApiProperty({ example: '2026-10-22T17:30:00.000Z' })
  @Expose()
  createdAt: Date;
}

@Exclude()
export class GoogleCallbackResponseDto {
  @ApiProperty({ description: 'Access Token JWT (Vigencia 15 min)' })
  @Expose()
  token: string;

  @ApiProperty({ description: 'Alias de Access Token' })
  @Expose()
  accessToken: string;

  @ApiProperty({ example: 900, description: 'Vigencia del Access Token en segundos' })
  @Expose()
  expiresInSeconds: number;

  @ApiProperty({ type: () => GoogleAuthUserDto })
  @Expose()
  @Type(() => GoogleAuthUserDto)
  user: GoogleAuthUserDto;

  @ApiProperty({ type: () => GoogleAuthUserDto })
  @Expose()
  @Type(() => GoogleAuthUserDto)
  userProfile: GoogleAuthUserDto;

  @ApiProperty({ example: '/' })
  @Expose()
  redirectTo: string;

  @ApiProperty({ example: 'Inicio de sesión con Google exitoso' })
  @Expose()
  message: string;
}

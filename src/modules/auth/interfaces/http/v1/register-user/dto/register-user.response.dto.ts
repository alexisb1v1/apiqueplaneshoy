import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Alexis Bermúdez' })
  name: string;

  @ApiProperty({ example: 'Alexis' })
  firstName: string;

  @ApiProperty({ example: 'Bermúdez' })
  lastName: string;

  @ApiProperty({ example: 'alexis@queplaneshoy.com' })
  email: string;

  @ApiProperty({ example: '+51 987654321', required: false, nullable: true })
  phone?: string | null;

  @ApiProperty({ example: 'customer' })
  role: string;

  @ApiProperty({ example: false })
  isOrganizer: boolean;

  @ApiProperty({ example: 'Productora Musical SAC', required: false, nullable: true })
  organizerName?: string | null;

  @ApiProperty({ example: 'RUC', required: false, nullable: true })
  organizerDocumentType?: string | null;

  @ApiProperty({ example: '20123456789', required: false, nullable: true })
  organizerDocumentNumber?: string | null;

  @ApiProperty({ example: 'https://cdn.queplaneshoy.com/logos/org.png', required: false, nullable: true })
  organizerLogoUrl?: string | null;

  @ApiProperty({ example: null, nullable: true })
  emailVerifiedAt: Date | null;

  @ApiProperty({ example: '2026-10-22T17:30:00.000Z' })
  createdAt: Date;
}

export class RegisterUserResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Access Token JWT (Vigencia 15 min)' })
  token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Alias de Access Token' })
  accessToken: string;

  @ApiProperty({ example: '4.a1b2c3d4.e5f6g7h8...', required: false, description: 'Refresh Token rotativo de larga duración (30 días)' })
  refreshToken?: string;

  @ApiProperty({ example: 900, description: 'Segundos de vigencia del Access Token (15 minutos = 900s)' })
  expiresInSeconds: number;

  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: () => AuthUserDto })
  userProfile: AuthUserDto;

  @ApiProperty({ example: 'Usuario registrado exitosamente' })
  message: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token de verificación de correo electrónico generado',
    required: false,
  })
  verificationToken?: string;

  constructor(
    token: string,
    userDto: AuthUserDto,
    message = 'Cuenta creada. Revisa tu correo para verificar tu cuenta.',
    verificationToken?: string,
    refreshToken?: string,
    expiresInSeconds = 900,
  ) {
    this.token = token;
    this.accessToken = token;
    this.refreshToken = refreshToken;
    this.expiresInSeconds = expiresInSeconds;
    this.user = userDto;
    this.userProfile = userDto;
    this.message = message;
    this.verificationToken = verificationToken;
  }
}

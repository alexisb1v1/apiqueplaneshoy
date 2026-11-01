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
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

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
  ) {
    this.token = token;
    this.accessToken = token;
    this.user = userDto;
    this.userProfile = userDto;
    this.message = message;
    this.verificationToken = verificationToken;
  }
}

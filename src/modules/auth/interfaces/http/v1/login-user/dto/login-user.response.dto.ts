import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';

export class LoginUserResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Access Token JWT (Vigencia 15 min)' })
  token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Alias de Access Token' })
  accessToken: string;

  @ApiPropertyOptional({ example: '4.a1b2c3d4.e5f6g7h8...', description: 'Refresh Token rotativo de larga duración (30 días)' })
  refreshToken?: string;

  @ApiProperty({ example: 900, description: 'Segundos de vigencia del Access Token (15 minutos = 900s)' })
  expiresInSeconds: number;

  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: () => AuthUserDto })
  userProfile: AuthUserDto;

  @ApiProperty({ example: 'Inicio de sesión exitoso' })
  message: string;

    constructor(
      token: string,
      userDto: AuthUserDto,
      message = 'Inicio de sesión exitoso',
      refreshToken ?: string,
      expiresInSeconds = 900,
    ) {
      this.token = token;
      this.accessToken = token;
      this.refreshToken = refreshToken;
      this.expiresInSeconds = expiresInSeconds;
      this.user = userDto;
      this.userProfile = userDto;
      this.message = message;
    }
  }

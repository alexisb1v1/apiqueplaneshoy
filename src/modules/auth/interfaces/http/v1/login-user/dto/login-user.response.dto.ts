import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';

export class LoginUserResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: () => AuthUserDto })
  userProfile: AuthUserDto;

  @ApiProperty({ example: 'Inicio de sesión exitoso' })
  message: string;

  constructor(token: string, userDto: AuthUserDto, message = 'Inicio de sesión exitoso') {
    this.token = token;
    this.accessToken = token;
    this.user = userDto;
    this.userProfile = userDto;
    this.message = message;
  }
}

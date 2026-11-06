import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';

export class VerifyEmailResponseDto {
  @ApiProperty({ example: 'Correo verificado exitosamente' })
  message: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  constructor(message: string, token: string, userDto: AuthUserDto) {
    this.message = message;
    this.token = token;
    this.accessToken = token;
    this.user = userDto;
  }
}

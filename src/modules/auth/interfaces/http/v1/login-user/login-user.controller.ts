import { Controller, Post, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { LoginUserRequestDto } from './dto/login-user.request.dto';
import { LoginUserResponseDto } from './dto/login-user.response.dto';
import { LoginUserCommand } from '@auth/application/commands/v1/login-user/login-user.command';
import { matchResult } from '@common/http/match-result';
import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_OPTIONS } from '@auth/constants/cookie.constants';

@ApiTags('Auth')
@Controller('auth')
export class LoginUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con credenciales de usuario' })
  @ApiResponse({
    status: 200,
    description: 'Inicio de sesión exitoso',
    type: LoginUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'Credenciales de acceso incorrectas' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(
    @Body() dto: LoginUserRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginUserResponseDto> {
    const result = await this.commandBus.execute(new LoginUserCommand(dto));

    return matchResult(
      result,
      (response: LoginUserResponseDto) => {
        if (response.refreshToken) {
          res.cookie(REFRESH_TOKEN_COOKIE_NAME, response.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        }
        return response;
      },
      {
        UNAUTHORIZED: 'Credenciales de acceso inválidas',
      },
    );
  }
}

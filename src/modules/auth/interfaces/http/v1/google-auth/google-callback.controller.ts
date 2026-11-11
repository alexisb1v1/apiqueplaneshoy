import { Controller, Post, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { GoogleCallbackRequestDto } from './dto/google-callback.request.dto';
import { GoogleCallbackResponseDto } from './dto/google-callback.response.dto';
import { GoogleCallbackCommand } from '@auth/application/commands/v1/google-callback/google-callback.command';
import { GoogleCallbackExecutionResult } from '@auth/application/commands/v1/google-callback/handlers/google-callback.handler';
import { matchResult } from '@common/http/match-result';
import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_OPTIONS } from '@auth/constants/cookie.constants';

@ApiTags('Auth')
@Controller('auth')
export class GoogleCallbackController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({
    summary: 'Procesa el callback OAuth de Google (/auth/google/callback), vincula o registra por correo y emite sesión JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Autenticación con Google completada',
    type: GoogleCallbackResponseDto,
  })
  @ApiResponse({ status: 400, description: 'State inválido/expirado o código OAuth inválido' })
  @ApiResponse({ status: 503, description: 'Google OAuth no configurado en el servidor' })
  async execute(
    @Body() dto: GoogleCallbackRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleCallbackResponseDto> {
    const result = await this.commandBus.execute(new GoogleCallbackCommand(dto));

    return matchResult(
      result,
      (payload: GoogleCallbackExecutionResult) => {
        if (payload.refreshToken) {
          res.cookie(REFRESH_TOKEN_COOKIE_NAME, payload.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        }
        return payload.response;
      },
      {
        GATEWAY_NOT_CONFIGURED:
          'El inicio de sesión con Google aún no está configurado en el servidor.',
        TOKEN_EXPIRED_OR_INVALID:
          'La sesión de autenticación con Google expiró o ya fue utilizada. Intenta iniciar sesión nuevamente.',
        INVALID_INPUT:
          'No se pudo validar tu cuenta con Google o tu correo no está verificado en Google.',
      },
    );
  }
}


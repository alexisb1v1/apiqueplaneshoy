import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RefreshTokenRequestDto } from './dto/refresh-token.request.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.response.dto';
import { RefreshTokenCommand } from '@auth/application/commands/v1/refresh-token/refresh-token.command';
import { matchResult } from '@common/http/match-result';
import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_OPTIONS } from '@auth/constants/cookie.constants';

@ApiTags('Auth')
@Controller('auth')
export class RefreshTokenController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar Access Token mediante Refresh Token (Soporta Cookie HttpOnly y Body)',
    description: 'Valida el Refresh Token en Redis (leído desde cookie HttpOnly o body), lo rota por uno nuevo y emite un nuevo Access Token JWT válido por 15 minutos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados exitosamente',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido, expirado o no proporcionado',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto?: RefreshTokenRequestDto,
  ): Promise<RefreshTokenResponseDto> {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || dto?.refreshToken;

    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('No se proporcionó token de actualización (Refresh Token).');
    }

    const result = await this.commandBus.execute(new RefreshTokenCommand({ refreshToken: rawToken }));
    return matchResult(
      result,
      (data: RefreshTokenResponseDto) => {
        if (data.refreshToken) {
          res.cookie(REFRESH_TOKEN_COOKIE_NAME, data.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        }
        return data;
      },
      {
        UNAUTHORIZED: 'El token de actualización es inválido, ha expirado o ya fue consumido.',
      },
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión e invalidar la cookie HttpOnly de Refresh Token' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean; message: string }> {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
    return { success: true, message: 'Sesión cerrada exitosamente' };
  }
}


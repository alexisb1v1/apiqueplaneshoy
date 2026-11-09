import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VerifyResetTokenQueryDto } from './dto/verify-reset-token.query.dto';
import { VerifyResetTokenResponseDto } from './dto/verify-reset-token.response.dto';
import { VerifyResetTokenQuery } from '@auth/application/queries/v1/verify-reset-token/verify-reset-token.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class VerifyResetTokenController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // Máximo 10 verificaciones de token por cada 15 minutos por IP
  @ApiOperation({ summary: 'Verificar validez de un token de recuperación de contraseña' })
  @ApiResponse({
    status: 200,
    description: 'El token es válido y no ha expirado',
    type: VerifyResetTokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes. Inténtalo más tarde.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(@Query() queryDto: VerifyResetTokenQueryDto): Promise<VerifyResetTokenResponseDto> {
    const result = await this.queryBus.execute(new VerifyResetTokenQuery(queryDto.token));

    return matchResult(result, (response: VerifyResetTokenResponseDto) => response, {
      TOKEN_EXPIRED_OR_INVALID: 'El enlace de recuperación ha expirado o ya ha sido utilizado.',
    });
  }
}


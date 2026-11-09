import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResetPasswordRequestDto } from './dto/reset-password.request.dto';
import { ResetPasswordResponseDto } from './dto/reset-password.response.dto';
import { ResetPasswordCommand } from '@auth/application/commands/v1/reset-password/reset-password.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class ResetPasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // Máximo 5 intentos por cada 15 minutos
  @ApiOperation({ summary: 'Restablecer contraseña mediante token seguro' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Token inválido, expirado o contraseña no cumple requisitos' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes. Inténtalo más tarde.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(@Body() dto: ResetPasswordRequestDto): Promise<ResetPasswordResponseDto> {
    const result = await this.commandBus.execute(new ResetPasswordCommand(dto));

    return matchResult(result, (response: ResetPasswordResponseDto) => response, {
      TOKEN_EXPIRED_OR_INVALID: 'El enlace de recuperación ha expirado o ya ha sido utilizado.',
    });
  }
}


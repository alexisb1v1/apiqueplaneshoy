import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordRequestDto } from './dto/forgot-password.request.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password.response.dto';
import { ForgotPasswordCommand } from '@auth/application/commands/v1/forgot-password/forgot-password.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class ForgotPasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // Máximo 3 solicitudes por cada 15 minutos por IP
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Instrucciones enviadas si el correo está registrado',
    type: ForgotPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Formato de correo electrónico inválido' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes. Inténtalo más tarde.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(@Body() dto: ForgotPasswordRequestDto): Promise<ForgotPasswordResponseDto> {
    const result = await this.commandBus.execute(new ForgotPasswordCommand(dto));

    return matchResult(result, (response: ForgotPasswordResponseDto) => response);
  }
}


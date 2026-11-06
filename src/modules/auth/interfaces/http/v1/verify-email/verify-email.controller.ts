import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VerifyEmailRequestDto } from './dto/verify-email.request.dto';
import { VerifyEmailResponseDto } from './dto/verify-email.response.dto';
import { VerifyEmailCommand } from '@auth/application/commands/v1/verify-email/verify-email.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class VerifyEmailController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar dirección de correo electrónico con token' })
  @ApiResponse({
    status: 200,
    description: 'Correo electrónico verificado exitosamente',
    type: VerifyEmailResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Token de verificación inválido o expirado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(@Body() dto: VerifyEmailRequestDto): Promise<VerifyEmailResponseDto> {
    const result = await this.commandBus.execute(new VerifyEmailCommand(dto));

    return matchResult(
      result,
      (response: VerifyEmailResponseDto) => response,
      {
        INVALID_INPUT: 'El token de verificación es inválido o ha expirado',
        NOT_FOUND: 'No se encontró la cuenta asociada al token',
      },
    );
  }
}

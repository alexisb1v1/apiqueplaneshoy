import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResendVerificationRequestDto } from './dto/resend-verification.request.dto';
import { ResendVerificationResponseDto } from './dto/resend-verification.response.dto';
import { ResendVerificationCommand } from '@auth/application/commands/v1/resend-verification/resend-verification.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class ResendVerificationController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar correo electrónico con token de verificación' })
  @ApiResponse({
    status: 200,
    description: 'Correo de verificación reenviado exitosamente',
    type: ResendVerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'El correo electrónico ya se encuentra verificado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(
    @Body() dto: ResendVerificationRequestDto,
  ): Promise<ResendVerificationResponseDto> {
    const result = await this.commandBus.execute(new ResendVerificationCommand(dto));

    return matchResult(
      result,
      (response: ResendVerificationResponseDto) => response,
      {
        NOT_FOUND: 'No se encontró ninguna cuenta asociada a este correo electrónico',
        ALREADY_EXISTS: 'La cuenta ya se encuentra verificada previamente',
      },
    );
  }
}

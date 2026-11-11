import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { ChangePasswordRequestDto } from './dto/change-password.request.dto';
import { ChangePasswordResponseDto } from './dto/change-password.response.dto';
import { ChangePasswordCommand } from '@auth/application/commands/v1/change-password/change-password.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class ChangePasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Cambiar la contraseña del usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o nueva contraseña inválida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos. Inténtalo más tarde.' })
  async execute(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<ChangePasswordResponseDto> {
    const publicUuid = req.user?.sub as string;
    const result = await this.commandBus.execute(new ChangePasswordCommand(publicUuid, dto));

    return matchResult(result, (response: ChangePasswordResponseDto) => response, {
      NOT_FOUND: 'Usuario no encontrado.',
      INVALID_CURRENT_PASSWORD: 'La contraseña actual ingresada es incorrecta.',
      INVALID_INPUT:
        'La nueva contraseña debe ser diferente a la actual (mínimo 6 caracteres) o tu cuenta fue registrada con inicio social sin clave local.',
    });
  }
}


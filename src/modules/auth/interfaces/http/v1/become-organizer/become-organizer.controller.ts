import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { BecomeOrganizerRequestDto } from './dto/become-organizer.request.dto';
import { RegisterUserResponseDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { BecomeOrganizerCommand } from '@auth/application/commands/v1/become-organizer/become-organizer.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class BecomeOrganizerController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('become-organizer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar el perfil de organizador para el usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil de organizador activado exitosamente con nuevo JWT emitido',
    type: RegisterUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BecomeOrganizerRequestDto,
  ): Promise<RegisterUserResponseDto> {
    const publicUuid = req.user?.sub as string;
    const result = await this.commandBus.execute(new BecomeOrganizerCommand(publicUuid, dto));

    return matchResult(
      result,
      (response: RegisterUserResponseDto) => response,
      {
        NOT_FOUND: 'Usuario no encontrado',
      },
    );
  }
}


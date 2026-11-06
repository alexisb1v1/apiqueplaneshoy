import { Controller, Put, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { UpdateProfileRequestDto } from './dto/update-profile.request.dto';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UpdateProfileCommand } from '@auth/application/commands/v1/update-profile/update-profile.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class UpdateProfileController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar información del perfil del usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil actualizado exitosamente',
    type: AuthUserDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<AuthUserDto> {
    const publicUuid = req.user?.sub as string;
    const result = await this.commandBus.execute(new UpdateProfileCommand(publicUuid, dto));

    return matchResult(
      result,
      (user: AuthUserDto) => user,
      {
        NOT_FOUND: 'Usuario no encontrado',
      },
    );
  }
}


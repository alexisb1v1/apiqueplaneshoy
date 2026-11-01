import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { GetCurrentUserQuery } from '@auth/application/queries/v1/get-current-user/get-current-user.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class GetCurrentUserController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener datos del usuario actualmente autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario obtenido con éxito',
    type: AuthUserDto,
  })
  @ApiResponse({ status: 401, description: 'Token de autenticación inválido o ausente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async execute(@Req() req: AuthenticatedRequest): Promise<AuthUserDto> {
    const publicUuid = req.user?.sub as string;
    const result = await this.queryBus.execute(new GetCurrentUserQuery(publicUuid));

    return matchResult(
      result,
      (user: AuthUserDto) => user,
      {
        NOT_FOUND: 'Usuario no encontrado',
      },
    );
  }
}

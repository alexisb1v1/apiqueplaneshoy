import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { ToggleFavoriteCommand } from '@users/application/commands/v1/toggle-favorite/toggle-favorite.command';
import { RemoveFavoriteCommand } from '@users/application/commands/v1/remove-favorite/remove-favorite.command';
import { GetUserFavoriteIdsQuery } from '@users/application/queries/v1/get-user-favorite-ids/get-user-favorite-ids.query';
import { GetUserFavoritesQuery } from '@users/application/queries/v1/get-user-favorites/get-user-favorites.query';
import { ToggleFavoriteResponseDto } from './dto/toggle-favorite.response.dto';
import { UserFavoriteIdsResponseDto } from './dto/user-favorite-ids.response.dto';
import { UserFavoriteEventItemResponseDto } from './dto/user-favorite-event-item.response.dto';
import { matchResult } from '@common/http/match-result';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/favorites')
export class UserFavoritesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':eventId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alternar (agregar o quitar) un evento en la lista de favoritos del usuario' })
  @ApiParam({ name: 'eventId', description: 'ID numérico o UUID público del evento' })
  @ApiResponse({
    status: 200,
    description: 'Estado de favorito actualizado',
    type: ToggleFavoriteResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async toggle(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ): Promise<ToggleFavoriteResponseDto> {
    const userId = req.user!.id;
    const result = await this.commandBus.execute(new ToggleFavoriteCommand(userId, eventId));

    return matchResult(result, (data: ToggleFavoriteResponseDto) => data, {
      NOT_FOUND: 'El evento especificado no existe o no está disponible.',
    });
  }

  @Get('ids')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener los identificadores de todos los eventos favoritos del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Listado de IDs y UUIDs de eventos favoritos',
    type: UserFavoriteIdsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getFavoriteIds(@Req() req: AuthenticatedRequest): Promise<UserFavoriteIdsResponseDto> {
    const userId = req.user!.id;
    const result = await this.queryBus.execute(new GetUserFavoriteIdsQuery(userId));

    return matchResult(result, (data: UserFavoriteIdsResponseDto) => data);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener todos los eventos favoritos del usuario con detalles' })
  @ApiResponse({
    status: 200,
    description: 'Listado de eventos favoritos',
    type: [UserFavoriteEventItemResponseDto],
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getFavorites(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserFavoriteEventItemResponseDto[]> {
    const userId = req.user!.id;
    const result = await this.queryBus.execute(new GetUserFavoritesQuery(userId));

    return matchResult(result, (data: UserFavoriteEventItemResponseDto[]) => data);
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quitar un evento de la lista de favoritos del usuario' })
  @ApiParam({ name: 'eventId', description: 'ID numérico o UUID público del evento' })
  @ApiResponse({ status: 200, description: 'Evento eliminado de favoritos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ): Promise<{ message: string }> {
    const userId = req.user!.id;
    const result = await this.commandBus.execute(new RemoveFavoriteCommand(userId, eventId));

    return matchResult(result, (data: { message: string }) => data);
  }
}


import { Inject, Injectable, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { GetUserFavoriteIdsQuery } from '../get-user-favorite-ids.query';
import { UserFavoriteIdsResponseDto } from '@users/interfaces/http/v1/favorites/dto/user-favorite-ids.response.dto';
import { UserFavoriteRepository } from '@users/domain/repositories/user-favorite.repository';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@QueryHandler(GetUserFavoriteIdsQuery)
export class GetUserFavoriteIdsHandler implements IQueryHandler<GetUserFavoriteIdsQuery> {
  private readonly logger = new Logger(GetUserFavoriteIdsHandler.name);

  constructor(
    @Inject('UserFavoriteRepository')
    private readonly favoriteRepository: UserFavoriteRepository,
  ) {}

  async execute(
    query: GetUserFavoriteIdsQuery,
  ): Promise<Result<UserFavoriteIdsResponseDto, AppError>> {
    try {
      const { ids, publicUuids } = await this.favoriteRepository.getFavoriteIds(query.userId);
      return ok(new UserFavoriteIdsResponseDto(ids, publicUuids));
    } catch (error) {
      this.logger.error(`Error al obtener IDs de favoritos: ${(error as Error).message}`);
      return err('INTERNAL_ERROR');
    }
  }
}


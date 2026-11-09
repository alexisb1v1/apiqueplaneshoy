import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { ToggleFavoriteCommand } from '../toggle-favorite.command';
import { ToggleFavoriteResponseDto } from '@users/interfaces/http/v1/favorites/dto/toggle-favorite.response.dto';
import { UserFavoriteRepository } from '@users/domain/repositories/user-favorite.repository';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(ToggleFavoriteCommand)
export class ToggleFavoriteHandler implements ICommandHandler<ToggleFavoriteCommand> {
  private readonly logger = new Logger(ToggleFavoriteHandler.name);

  constructor(
    @Inject('UserFavoriteRepository')
    private readonly favoriteRepository: UserFavoriteRepository,
  ) {}

  async execute(
    command: ToggleFavoriteCommand,
  ): Promise<Result<ToggleFavoriteResponseDto, AppError>> {
    const { userId, eventId } = command;

    try {
      const result = await this.favoriteRepository.toggleFavorite(userId, eventId);

      if (!result) {
        return err('NOT_FOUND');
      }

      const { isFavorite, event } = result;
      const message = isFavorite
        ? 'Evento agregado a tus favoritos.'
        : 'Evento retirado de tus favoritos.';

      return ok(new ToggleFavoriteResponseDto(isFavorite, event.id, event.publicUuid, message));
    } catch (error) {
      this.logger.error(`Error al alternar favorito: ${(error as Error).message}`);
      return err('INTERNAL_ERROR');
    }
  }
}


import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { RemoveFavoriteCommand } from '../remove-favorite.command';
import { UserFavoriteRepository } from '@users/domain/repositories/user-favorite.repository';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(RemoveFavoriteCommand)
export class RemoveFavoriteHandler implements ICommandHandler<RemoveFavoriteCommand> {
  private readonly logger = new Logger(RemoveFavoriteHandler.name);

  constructor(
    @Inject('UserFavoriteRepository')
    private readonly favoriteRepository: UserFavoriteRepository,
  ) {}

  async execute(
    command: RemoveFavoriteCommand,
  ): Promise<Result<{ message: string }, AppError>> {
    const { userId, eventId } = command;

    try {
      await this.favoriteRepository.removeFavorite(userId, eventId);
      return ok({ message: 'Evento eliminado de favoritos exitosamente.' });
    } catch (error) {
      this.logger.error(`Error al eliminar favorito: ${(error as Error).message}`);
      return err('INTERNAL_ERROR');
    }
  }
}


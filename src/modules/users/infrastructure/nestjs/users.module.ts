import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { UserEntity } from '@users/domain/entities/user.entity';
import { SocialIdentityEntity } from '@users/domain/entities/social-identity.entity';
import { UserFavoriteEventEntity } from '@users/domain/entities/user-favorite-event.entity';
import { OrganizerBankAccountEntity } from '@users/domain/entities/organizer-bank-account.entity';
import { EventEntity } from '@events/domain/entities/event.entity';
import { TypeormUserRepository } from '../persistence/typeorm-user.repository';
import { TypeormUserFavoriteRepository } from '../persistence/typeorm-user-favorite.repository';
import { ToggleFavoriteHandler } from '@users/application/commands/v1/toggle-favorite/handlers/toggle-favorite.handler';
import { RemoveFavoriteHandler } from '@users/application/commands/v1/remove-favorite/handlers/remove-favorite.handler';
import { GetUserFavoritesHandler } from '@users/application/queries/v1/get-user-favorites/handlers/get-user-favorites.handler';
import { GetUserFavoriteIdsHandler } from '@users/application/queries/v1/get-user-favorite-ids/handlers/get-user-favorite-ids.handler';
import { UserFavoritesController } from '@users/interfaces/http/v1/favorites/user-favorites.controller';
import { AuthModule } from '@auth/auth.module';

const CommandHandlers = [ToggleFavoriteHandler, RemoveFavoriteHandler];
const QueryHandlers = [GetUserFavoritesHandler, GetUserFavoriteIdsHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      UserEntity,
      SocialIdentityEntity,
      UserFavoriteEventEntity,
      OrganizerBankAccountEntity,
      EventEntity,
    ]),
  ],
  controllers: [UserFavoritesController],
  providers: [
    {
      provide: 'UserRepository',
      useClass: TypeormUserRepository,
    },
    TypeormUserRepository,
    {
      provide: 'UserFavoriteRepository',
      useClass: TypeormUserFavoriteRepository,
    },
    TypeormUserFavoriteRepository,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    TypeOrmModule,
    'UserRepository',
    TypeormUserRepository,
    'UserFavoriteRepository',
    TypeormUserFavoriteRepository,
  ],
})
export class UsersModule {}

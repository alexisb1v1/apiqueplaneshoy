import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@users/domain/entities/user.entity';
import { SocialIdentityEntity } from '@users/domain/entities/social-identity.entity';
import { UserFavoriteEventEntity } from '@users/domain/entities/user-favorite-event.entity';
import { TypeormUserRepository } from '../persistence/typeorm-user.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SocialIdentityEntity, UserFavoriteEventEntity]),
  ],
  providers: [
    {
      provide: 'UserRepository',
      useClass: TypeormUserRepository,
    },
    TypeormUserRepository,
  ],
  exports: [
    TypeOrmModule,
    'UserRepository',
    TypeormUserRepository,
  ],
})
export class UsersModule {}

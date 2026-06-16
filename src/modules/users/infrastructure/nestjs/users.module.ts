import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@users/domain/entities/user.entity';
import { SocialIdentityEntity } from '@users/domain/entities/social-identity.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SocialIdentityEntity]),
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class UsersModule {}

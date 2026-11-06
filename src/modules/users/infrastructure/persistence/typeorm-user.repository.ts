import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { UserEntity } from '@users/domain/entities/user.entity';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByPublicUuid(publicUuid: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { publicUuid },
    });
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    const userEntity = this.repository.create(user);
    return this.repository.save(userEntity);
  }
}

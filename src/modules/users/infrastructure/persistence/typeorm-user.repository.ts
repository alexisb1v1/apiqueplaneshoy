import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserRepository,
  UserSearchFilters,
  PaginatedUsersResult,
} from '@users/domain/repositories/user.repository';
import { UserEntity } from '@users/domain/entities/user.entity';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) { }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { username: username.toLowerCase().trim() },
    });
  }

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

  async findPaginated(filters: UserSearchFilters): Promise<PaginatedUsersResult> {
    const { role, search, isOrganizer, page, limit } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .leftJoin('tickets', 'ticket', 'ticket.user_id = user.id')
      .select([
        'user.id AS "userId"',
        'user.public_uuid AS "publicUuid"',
        'user.name AS "name"',
        'user.email AS "email"',
        'user.username AS "username"',
        'user.role AS "role"',
        'user.is_organizer AS "isOrganizer"',
        'user.organizer_name AS "organizerName"',
        'user.organizer_document_type AS "organizerDocumentType"',
        'user.organizer_document_number AS "organizerDocumentNumber"',
        'user.organizer_phone AS "organizerPhone"',
        'user.email_verified_at AS "emailVerifiedAt"',
        'user.created_at AS "createdAt"',
        'COUNT(ticket.id)::int AS "ticketsCount"',
      ])
      .groupBy('user.id');

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (typeof isOrganizer === 'boolean') {
      queryBuilder.andWhere('user.is_organizer = :isOrganizer', { isOrganizer });
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(user.name) LIKE :term OR LOWER(user.email) LIKE :term OR LOWER(user.username) LIKE :term)',
        { term },
      );
    }

    // Contar total de registros únicos que cumplen la condición
    const countQueryBuilder = this.repository.createQueryBuilder('user');
    if (role) {
      countQueryBuilder.andWhere('user.role = :role', { role });
    }
    if (typeof isOrganizer === 'boolean') {
      countQueryBuilder.andWhere('user.is_organizer = :isOrganizer', { isOrganizer });
    }
    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQueryBuilder.andWhere(
        '(LOWER(user.name) LIKE :term OR LOWER(user.email) LIKE :term OR LOWER(user.username) LIKE :term)',
        { term },
      );
    }

    const total = await countQueryBuilder.getCount();

    // Paginación y orden
    queryBuilder
      .orderBy('user.created_at', 'DESC')
      .offset(skip)
      .limit(limit);

    const rawResults = await queryBuilder.getRawMany();

    const items = rawResults.map((raw) => {
      const user = new UserEntity();
      user.id = Number(raw.userId);
      user.publicUuid = raw.publicUuid;
      user.name = raw.name;
      user.email = raw.email;
      user.username = raw.username;
      user.role = raw.role;
      user.isOrganizer = Boolean(raw.isOrganizer);
      user.organizerName = raw.organizerName;
      user.organizerDocumentType = raw.organizerDocumentType;
      user.organizerDocumentNumber = raw.organizerDocumentNumber;
      user.organizerPhone = raw.organizerPhone;
      user.emailVerifiedAt = raw.emailVerifiedAt ? new Date(raw.emailVerifiedAt) : null;
      user.createdAt = new Date(raw.createdAt);

      return {
        user,
        ticketsCount: Number(raw.ticketsCount || 0),
      };
    });

    return {
      items,
      total,
    };
  }
}

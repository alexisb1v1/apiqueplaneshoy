import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { ListUsersQuery } from '../list-users.query';
import {
  ListUsersResponseDto,
  UserListItemDto,
  ListUsersPaginationMetaDto,
} from '@users/interfaces/http/v1/list-users/dto/list-users.response.dto';

@Injectable()
@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery, Result<ListUsersResponseDto, AppError>> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: ListUsersQuery): Promise<Result<ListUsersResponseDto, AppError>> {
    try {
      const page = query.dto.page && query.dto.page > 0 ? query.dto.page : 1;
      const limit = query.dto.limit && query.dto.limit > 0 ? query.dto.limit : 10;
      const role = query.dto.role?.trim();
      const search = query.dto.search?.trim();
      const isOrganizer = query.dto.isOrganizer;

      const { items, total } = await this.userRepository.findPaginated({
        role,
        search,
        isOrganizer,
        page,
        limit,
      });

      const totalPages = Math.ceil(total / limit) || 1;

      const userDtos: UserListItemDto[] = items.map(({ user, ticketsCount }) => {
        const item = new UserListItemDto();
        item.id = user.id;
        item.publicUuid = user.publicUuid;
        item.name = user.name;
        item.email = user.email;
        item.username = user.username;
        item.role = user.role;
        item.isOrganizer = user.isOrganizer;
        item.organizerName = user.organizerName;
        item.organizerDocumentType = user.organizerDocumentType;
        item.organizerDocumentNumber = user.organizerDocumentNumber;
        item.organizerPhone = user.organizerPhone;
        item.isEmailVerified = !!user.emailVerifiedAt;
        item.emailVerifiedAt = user.emailVerifiedAt;
        item.ticketsCount = ticketsCount;
        item.createdAt = user.createdAt;
        return item;
      });

      const meta = new ListUsersPaginationMetaDto();
      meta.total = total;
      meta.page = page;
      meta.limit = limit;
      meta.totalPages = totalPages;
      meta.hasNextPage = page < totalPages;
      meta.hasPrevPage = page > 1;

      const response = new ListUsersResponseDto();
      response.data = userDtos;
      response.meta = meta;

      return ok(response);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}


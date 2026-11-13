import { ListUsersQueryDto } from '@users/interfaces/http/v1/list-users/dto/list-users.query.dto';

export class ListUsersQuery {
  constructor(public readonly dto: ListUsersQueryDto) {}
}


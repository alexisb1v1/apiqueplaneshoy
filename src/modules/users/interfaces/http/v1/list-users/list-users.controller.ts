import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { ListUsersResponseDto } from './dto/list-users.response.dto';
import { ListUsersQuery } from '@users/application/queries/v1/list-users/list-users.query';
import { JwtAuthGuard } from '@auth/infrastructure/guards/jwt-auth.guard';
import { RolesAdminGuard } from '@common/guards/roles-admin.guard';
import { matchResult } from '@common/http/match-result';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class ListUsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuarios paginados por rol y búsqueda (Exclusivo Backoffice)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de usuarios obtenida exitosamente',
    type: ListUsersResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token de autenticación faltante o inválido' })
  @ApiResponse({ status: 403, description: 'Acceso restringido solo para administradores' })
  async execute(@Query() queryDto: ListUsersQueryDto): Promise<ListUsersResponseDto> {
    const result = await this.queryBus.execute(new ListUsersQuery(queryDto));

    return matchResult(result, (data: ListUsersResponseDto) => data, {
      FORBIDDEN: 'Acceso no permitido',
      INTERNAL_ERROR: 'Error al consultar la lista de usuarios',
    });
  }
}


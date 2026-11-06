import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { GetCurrentUserQuery } from '../get-current-user.query';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUserQuery> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Obtiene el perfil público del usuario autenticado mediante su UUID público.
   *
   * @param query - Contiene el `publicUuid` del usuario autenticado.
   * @returns Result con `AuthUserDto` en caso exitoso, o `AppError` en caso de error.
   *
   * @throws NOT_FOUND si el usuario no existe en la base de datos.
   */
  async execute(query: GetCurrentUserQuery): Promise<Result<AuthUserDto, AppError>> {
    const user = await this.userRepository.findByPublicUuid(query.publicUuid);
    if (!user) {
      return err('NOT_FOUND');
    }

    const names = user.name.trim().split(' ');
    const firstName = names[0] || user.name;
    const lastName = names.slice(1).join(' ') || '';

    const userDto: AuthUserDto = {
      id: user.publicUuid,
      name: user.name,
      firstName,
      lastName,
      email: user.email,
      phone: user.organizerPhone,
      role: user.role,
      isOrganizer: user.isOrganizer,
      organizerName: user.organizerName,
      organizerDocumentType: user.organizerDocumentType,
      organizerDocumentNumber: user.organizerDocumentNumber,
      organizerLogoUrl: user.organizerLogoUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };

    return ok(userDto);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { UpdateProfileCommand } from '../update-profile.command';
import { AuthUserDto } from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { AppError } from '@common/errors/app-errors';

@Injectable()
@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Actualiza los datos de perfil del usuario autenticado en la base de datos
   *
   * @param command Contiene el `publicUuid` y el DTO con los datos actualizables
   * @returns Result con AuthUserDto actualizado o AppError
   */
  async execute(command: UpdateProfileCommand): Promise<Result<AuthUserDto, AppError>> {
    const { publicUuid, dto } = command;

    const user = await this.userRepository.findByPublicUuid(publicUuid);
    if (!user) {
      return err('NOT_FOUND');
    }

    // Resolver nombre completo
    let resolvedName = user.name;
    if (dto.name) {
      resolvedName = dto.name;
    } else if (dto.firstName || dto.lastName) {
      const first = dto.firstName || user.name.split(' ')[0] || '';
      const last = dto.lastName || user.name.split(' ').slice(1).join(' ') || '';
      resolvedName = `${first} ${last}`.trim();
    }

    user.name = resolvedName;

    if (dto.phone !== undefined) {
      user.organizerPhone = dto.phone ? dto.phone.trim() : null;
    }

    if (dto.organizerName !== undefined) {
      user.organizerName = dto.organizerName ? dto.organizerName.trim() : null;
      user.isOrganizer = true;
    }

    if (dto.organizerDocumentType !== undefined) {
      user.organizerDocumentType = dto.organizerDocumentType ? dto.organizerDocumentType.trim() : null;
    }

    if (dto.organizerDocumentNumber !== undefined) {
      user.organizerDocumentNumber = dto.organizerDocumentNumber ? dto.organizerDocumentNumber.trim() : null;
    }

    if (dto.organizerLogoUrl !== undefined) {
      user.organizerLogoUrl = dto.organizerLogoUrl ? dto.organizerLogoUrl.trim() : null;
    }

    try {
      const updatedUser = await this.userRepository.save(user);

      const names = updatedUser.name.trim().split(' ');
      const firstName = names[0] || updatedUser.name;
      const lastName = names.slice(1).join(' ') || '';

      const userDto: AuthUserDto = {
        id: updatedUser.publicUuid,
        name: updatedUser.name,
        firstName,
        lastName,
        email: updatedUser.email,
        phone: updatedUser.organizerPhone,
        role: updatedUser.role,
        isOrganizer: updatedUser.isOrganizer,
        organizerName: updatedUser.organizerName,
        organizerDocumentType: updatedUser.organizerDocumentType,
        organizerDocumentNumber: updatedUser.organizerDocumentNumber,
        organizerLogoUrl: updatedUser.organizerLogoUrl,
        emailVerifiedAt: updatedUser.emailVerifiedAt,
        createdAt: updatedUser.createdAt,
      };

      return ok(userDto);
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}


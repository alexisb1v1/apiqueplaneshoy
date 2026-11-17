import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { BecomeOrganizerCommand } from '../become-organizer.command';
import {
  AuthUserDto,
  RegisterUserResponseDto,
} from '@auth/interfaces/http/v1/register-user/dto/register-user.response.dto';
import { UserRepository } from '@users/domain/repositories/user.repository';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { AppError } from '@common/errors/app-errors';
import { MailService } from '@modules/mail/mail.service';

@Injectable()
@CommandHandler(BecomeOrganizerCommand)
export class BecomeOrganizerHandler implements ICommandHandler<BecomeOrganizerCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Activa el perfil de organizador de un usuario autenticado y guarda sus datos comerciales.
   *
   * @param command - Contiene el `publicUuid` del usuario autenticado y los datos de organizador.
   * @returns Result con `RegisterUserResponseDto` (nuevo token y datos actualizados) o `AppError`.
   *
   * @throws NOT_FOUND si el usuario no existe.
   * @throws INTERNAL_ERROR si falla la persistencia en base de datos.
   */
  async execute(
    command: BecomeOrganizerCommand,
  ): Promise<Result<RegisterUserResponseDto, AppError>> {
    const { publicUuid, dto } = command;

    const user = await this.userRepository.findByPublicUuid(publicUuid);
    if (!user) {
      return err('NOT_FOUND');
    }

    user.isOrganizer = true;
    user.organizerName = dto.organizerName.trim();
    user.organizerDocumentType = dto.organizerDocumentType;
    user.organizerDocumentNumber = dto.organizerDocumentNumber.trim();
    user.organizerPhone = dto.organizerPhone.trim();

    if (dto.organizerLogoUrl) {
      user.organizerLogoUrl = dto.organizerLogoUrl.trim();
    }

    try {
      const savedUser = await this.userRepository.save(user);

      // Notificación no bloqueante de activación de perfil organizador
      this.mailService
        .sendOrganizerActivatedEmail({
          to: savedUser.email,
          name: savedUser.name,
          organizerName: savedUser.organizerName || savedUser.name,
          documentType: savedUser.organizerDocumentType || 'RUC',
          documentNumber: savedUser.organizerDocumentNumber || '-',
        })
        .catch(() => {});

      const token = this.tokenService.generateToken({
        sub: savedUser.publicUuid,
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isOrganizer: true,
        emailVerified: !!savedUser.emailVerifiedAt,
      });

      const names = savedUser.name.trim().split(' ');
      const firstName = names[0] || savedUser.name;
      const lastName = names.slice(1).join(' ') || '';

      const userDto: AuthUserDto = {
        id: savedUser.publicUuid,
        name: savedUser.name,
        firstName,
        lastName,
        email: savedUser.email,
        phone: savedUser.organizerPhone,
        role: savedUser.role,
        isOrganizer: true,
        organizerName: savedUser.organizerName,
        organizerDocumentType: savedUser.organizerDocumentType,
        organizerDocumentNumber: savedUser.organizerDocumentNumber,
        organizerLogoUrl: savedUser.organizerLogoUrl,
        emailVerifiedAt: savedUser.emailVerifiedAt,
        createdAt: savedUser.createdAt,
      };

      return ok(
        new RegisterUserResponseDto(
          token,
          userDto,
          'Perfil de organizador activado exitosamente.',
        ),
      );
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}


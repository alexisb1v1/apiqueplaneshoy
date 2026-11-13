import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { PublishEventCommand } from '@events/commands/impl/publish-event.command';
import { EventEntity } from '@events/domain/entities/event.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { AppError } from '@common/errors/app-errors';
import { SearchService } from '../../../search/services/search.service';
import { MailService } from '@modules/mail/mail.service';

@CommandHandler(PublishEventCommand)
export class PublishEventHandler implements ICommandHandler<PublishEventCommand> {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly searchService: SearchService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Publica un evento guardado previamente como borrador.
   * Plan B: Requiere de forma obligatoria que el organizador tenga su correo verificado
   * (`emailVerifiedAt` no nulo). Si no está verificado, retorna EMAIL_NOT_VERIFIED (403).
   */
  async execute(
    command: PublishEventCommand,
  ): Promise<Result<EventEntity, AppError>> {
    const { publicUuid, eventIdentifier } = command;

    const user = await this.userRepository.findOne({
      where: { publicUuid },
    });

    if (!user) {
      return err('NOT_FOUND');
    }

    // Regla de Oro del Plan B: La publicación requiere correo verificado
    if (!user.emailVerifiedAt) {
      return err('EMAIL_NOT_VERIFIED');
    }

    // Buscar el evento por ID o por publicUuid
    let event: EventEntity | null = null;
    const isNumeric = /^\d+$/.test(eventIdentifier);

    if (isNumeric) {
      event = await this.eventRepository.findOne({
        where: { id: eventIdentifier },
      });
    } else {
      event = await this.eventRepository.findOne({
        where: { publicUuid: eventIdentifier },
      });
    }

    if (!event) {
      return err('NOT_FOUND');
    }

    // Autorización BOLA: Validar propiedad del evento
    if (event.organizerId !== user.id && user.role !== 'admin') {
      return err('FORBIDDEN');
    }

    try {
      // Si el rol es admin, aprueba y publica directamente.
      // Si el rol es promotor/organizador, pasa a 'in_review' para moderación en el Backoffice.
      event.status = user.role === 'admin' ? 'published' : 'in_review';
      const updatedEvent = await this.eventRepository.save(event);

      // Solo sincronizar en Meilisearch si pasa a published
      if (updatedEvent.status === 'published') {
        this.searchService.indexEvent({
          id: updatedEvent.id.toString(),
          publicUuid: updatedEvent.publicUuid,
          title: updatedEvent.name,
          slug: updatedEvent.slug,
          description: updatedEvent.description,
          category: updatedEvent.category,
          tags: updatedEvent.tags || [],
          venue: updatedEvent.venue,
          address: updatedEvent.address,
          ubigeoCode: updatedEvent.ubigeoCode,
          status: updatedEvent.status,
          minPrice: 0,
          date: updatedEvent.createdAt ? updatedEvent.createdAt.toISOString() : new Date().toISOString(),
          hasLandingPage: updatedEvent.hasLandingPage,
          isFeatured: updatedEvent.isFeatured,
        }).catch(() => {});
      }

      // Notificación al organizador
      const publicPath =
        updatedEvent.hasLandingPage && updatedEvent.slug
          ? `/e/${updatedEvent.slug}`
          : `/events/${updatedEvent.publicUuid}`;

      if (updatedEvent.status === 'published') {
        this.mailService
          .sendEventPublishedEmail({
            to: user.email,
            name: user.organizerName || user.name,
            eventTitle: updatedEvent.name,
            eventPublicUrl: publicPath,
            venueName: updatedEvent.venue,
            category: updatedEvent.category,
          })
          .catch(() => {});
      }

      return ok(updatedEvent);
    } catch {
      return err('INTERNAL_ERROR');
    }
  }
}


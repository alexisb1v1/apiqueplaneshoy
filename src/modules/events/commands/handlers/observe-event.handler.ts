import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { ObserveEventCommand } from '../impl/observe-event.command';
import { EventEntity } from '@events/domain/entities/event.entity';
import { AppError } from '@common/errors/app-errors';

@CommandHandler(ObserveEventCommand)
export class ObserveEventHandler implements ICommandHandler<ObserveEventCommand, Result<EventEntity, AppError>> {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  async execute(command: ObserveEventCommand): Promise<Result<EventEntity, AppError>> {
    const { eventIdentifier, reason } = command;

    let event: EventEntity | null = null;
    const isNumeric = /^\d+$/.test(eventIdentifier);

    if (isNumeric) {
      event = await this.eventRepository.findOne({ where: { id: eventIdentifier } });
    } else {
      event = await this.eventRepository.findOne({ where: { publicUuid: eventIdentifier } });
    }

    if (!event) {
      return err('NOT_FOUND');
    }

    event.status = 'observed';
    event.observationReason = reason?.trim() || null;
    if (reason) {
      const currentConfig = event.landingConfig || {};
      event.landingConfig = {
        ...currentConfig,
        observationReason: reason.trim(),
        observedAt: new Date().toISOString(),
      };
    }

    const updated = await this.eventRepository.save(event);
    return ok(updated);
  }
}


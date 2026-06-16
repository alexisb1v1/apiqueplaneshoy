import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ok, err, Result } from 'neverthrow';
import { CreateEventCommand } from '@events/commands/impl/create-event.command';
import { EventEntity } from '@events/domain/entities/event.entity';
import { AppError } from '@common/errors/app-errors';

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  async execute(
    command: CreateEventCommand,
  ): Promise<Result<EventEntity, AppError>> {
    const { dto } = command;

    try {
      const event = this.eventRepository.create({
        name: dto.title,
        description: dto.description || null,
        organizerId: 1, // ID de organizador temporal para compatibilidad
        status: 'draft',
      });

      const savedEvent = await this.eventRepository.save(event);
      return ok(savedEvent);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }
}

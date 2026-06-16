import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './domain/entities/event.entity';
import { EventImageEntity } from './domain/entities/event-image.entity';
import { ShowEntity } from './domain/entities/show.entity';
import { ZoneEntity } from './domain/entities/zone.entity';
import { EventsController } from './controllers/events.controller';
import { CreateEventHandler } from './commands/handlers/create-event.handler';

const CommandHandlers = [CreateEventHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([EventEntity, EventImageEntity, ShowEntity, ZoneEntity]),
  ],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class EventsModule {}

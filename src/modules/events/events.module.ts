import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './domain/event.entity';
import { EventsController } from './controllers/events.controller';
import { CreateEventHandler } from './commands/handlers/create-event.handler';

const CommandHandlers = [CreateEventHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([EventEntity]),
  ],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
  ],
})
export class EventsModule {}

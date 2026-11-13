import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './domain/entities/event.entity';
import { EventImageEntity } from './domain/entities/event-image.entity';
import { ShowEntity } from './domain/entities/show.entity';
import { ZoneEntity } from './domain/entities/zone.entity';
import { ZonePricingTierEntity } from './domain/entities/zone-pricing-tier.entity';
import { EventAdvanceEntity } from './domain/entities/event-advance.entity';
import { EventSettlementEntity } from './domain/entities/event-settlement.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { OrderEntity } from '@orders/domain/entities/order.entity';
import { TicketEntity } from '@orders/domain/entities/ticket.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { AuthModule } from '@auth/auth.module';
import { SearchModule } from '../search/search.module';
import { EventsController } from './controllers/events.controller';
import { CreateEventHandler } from './commands/handlers/create-event.handler';
import { UpdateEventHandler } from './commands/handlers/update-event.handler';
import { PublishEventHandler } from './commands/handlers/publish-event.handler';
import { GetFeaturedEventsHandler } from './queries/handlers/get-featured-events.handler';
import { GetUpcomingEventsHandler } from './queries/handlers/get-upcoming-events.handler';
import { GetWeeklyFeaturedEventsHandler } from './queries/handlers/get-weekly-featured-events.handler';
import { GetWeekendEventsHandler } from './queries/handlers/get-weekend-events.handler';
import { GetEventLandingHandler } from './queries/handlers/get-event-landing.handler';
import { GetEventDetailHandler } from './queries/handlers/get-event-detail.handler';
import { GetOrganizerEventsHandler } from './queries/handlers/get-organizer-events.handler';
import { GetOrganizerEventForEditHandler } from './queries/handlers/get-organizer-event-for-edit.handler';
import { EventStatusCronService } from './services/event-status-cron.service';
import { EventSeederService } from './services/event-seeder.service';
import { AdminKeyGuard } from '@common/guards/admin-key.guard';

const CommandHandlers = [CreateEventHandler, UpdateEventHandler, PublishEventHandler];
const QueryHandlers = [
  GetFeaturedEventsHandler,
  GetUpcomingEventsHandler,
  GetWeeklyFeaturedEventsHandler,
  GetWeekendEventsHandler,
  GetEventLandingHandler,
  GetEventDetailHandler,
  GetOrganizerEventsHandler,
  GetOrganizerEventForEditHandler,
];

@Module({
  imports: [
    CqrsModule,
    AuthModule,
    SearchModule,
    TypeOrmModule.forFeature([
      EventEntity,
      EventImageEntity,
      ShowEntity,
      ZoneEntity,
      ZonePricingTierEntity,
      EventAdvanceEntity,
      EventSettlementEntity,
      CouponEntity,
      OrderEntity,
      TicketEntity,
      UserEntity,
    ]),
  ],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    EventStatusCronService,
    EventSeederService,
    AdminKeyGuard,
  ],
  exports: [
    TypeOrmModule,
    EventStatusCronService,
    EventSeederService,
    AdminKeyGuard,
  ],
})
export class EventsModule {}

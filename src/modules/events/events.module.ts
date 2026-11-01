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
import { UserEntity } from '@users/domain/entities/user.entity';
import { AuthModule } from '@auth/auth.module';
import { SearchModule } from '../search/search.module';
import { EventsController } from './controllers/events.controller';
import { CreateEventHandler } from './commands/handlers/create-event.handler';
import { PublishEventHandler } from './commands/handlers/publish-event.handler';
import { GetFeaturedEventsHandler } from './queries/handlers/get-featured-events.handler';
import { GetUpcomingEventsHandler } from './queries/handlers/get-upcoming-events.handler';
import { GetWeeklyFeaturedEventsHandler } from './queries/handlers/get-weekly-featured-events.handler';
import { GetWeekendEventsHandler } from './queries/handlers/get-weekend-events.handler';

const CommandHandlers = [CreateEventHandler, PublishEventHandler];
const QueryHandlers = [
  GetFeaturedEventsHandler,
  GetUpcomingEventsHandler,
  GetWeeklyFeaturedEventsHandler,
  GetWeekendEventsHandler,
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
      UserEntity,
    ]),
  ],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class EventsModule {}

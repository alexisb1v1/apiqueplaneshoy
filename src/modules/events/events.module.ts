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
import { RedisModule } from '../redis/redis.module';
import { EventsController } from './controllers/events.controller';
import { CreateEventHandler } from './commands/handlers/create-event.handler';
import { UpdateEventHandler } from './commands/handlers/update-event.handler';
import { PublishEventHandler } from './commands/handlers/publish-event.handler';
import { ApproveEventHandler } from './commands/handlers/approve-event.handler';
import { ObserveEventHandler } from './commands/handlers/observe-event.handler';
import { RequestEventSettlementHandler } from './commands/handlers/request-event-settlement.handler';
import { AdminPaySettlementHandler } from './commands/handlers/admin-pay-settlement.handler';
import { AdminRejectSettlementHandler } from './commands/handlers/admin-reject-settlement.handler';
import { GetFeaturedEventsHandler } from './queries/handlers/get-featured-events.handler';
import { GetUpcomingEventsHandler } from './queries/handlers/get-upcoming-events.handler';
import { GetWeeklyFeaturedEventsHandler } from './queries/handlers/get-weekly-featured-events.handler';
import { GetWeekendEventsHandler } from './queries/handlers/get-weekend-events.handler';
import { GetEventLandingHandler } from './queries/handlers/get-event-landing.handler';
import { GetEventDetailHandler } from './queries/handlers/get-event-detail.handler';
import { GetOrganizerEventsHandler } from './queries/handlers/get-organizer-events.handler';
import { GetOrganizerEventForEditHandler } from './queries/handlers/get-organizer-event-for-edit.handler';
import { GetOrganizerEventReportHandler } from './queries/handlers/get-organizer-event-report.handler';
import { GetEventSettlementHandler } from './queries/handlers/get-event-settlement.handler';
import { ListAdminSettlementsHandler } from './queries/handlers/list-admin-settlements.handler';
import { ListEventApprovalsHandler } from './queries/handlers/list-event-approvals.handler';
import { EventStatusCronService } from './services/event-status-cron.service';
import { EventSeederService } from './services/event-seeder.service';
import { UmamiAnalyticsService } from './services/umami-analytics.service';
import { AdminKeyGuard } from '@common/guards/admin-key.guard';

const CommandHandlers = [
  CreateEventHandler,
  UpdateEventHandler,
  PublishEventHandler,
  ApproveEventHandler,
  ObserveEventHandler,
  RequestEventSettlementHandler,
  AdminPaySettlementHandler,
  AdminRejectSettlementHandler,
];
const QueryHandlers = [
  GetFeaturedEventsHandler,
  GetUpcomingEventsHandler,
  GetWeeklyFeaturedEventsHandler,
  GetWeekendEventsHandler,
  GetEventLandingHandler,
  GetEventDetailHandler,
  GetOrganizerEventsHandler,
  GetOrganizerEventForEditHandler,
  GetOrganizerEventReportHandler,
  GetEventSettlementHandler,
  ListAdminSettlementsHandler,
  ListEventApprovalsHandler,
];

@Module({
  imports: [
    CqrsModule,
    AuthModule,
    SearchModule,
    RedisModule,
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
    UmamiAnalyticsService,
    AdminKeyGuard,
  ],
  exports: [
    TypeOrmModule,
    EventStatusCronService,
    EventSeederService,
    UmamiAnalyticsService,
    AdminKeyGuard,
  ],
})
export class EventsModule {}

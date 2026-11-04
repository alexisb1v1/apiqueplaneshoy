import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateEventDto } from '../dto/create-event.dto';
import { FeaturedEventResponseDto } from '../dto/featured-event.response.dto';
import { HomeEventCardResponseDto } from '../dto/home-event-card.response.dto';
import { EventLandingResponseDto } from '../dto/event-landing.response.dto';
import { EventDetailResponseDto } from '../dto/event-detail.response.dto';
import { PurgeFeaturedCacheResponseDto } from '../dto/purge-featured-cache.response.dto';
import { CreateEventCommand } from '../commands/impl/create-event.command';
import { PublishEventCommand } from '../commands/impl/publish-event.command';
import { GetFeaturedEventsQuery } from '../queries/impl/get-featured-events.query';
import { GetUpcomingEventsQuery } from '../queries/impl/get-upcoming-events.query';
import { GetWeeklyFeaturedEventsQuery } from '../queries/impl/get-weekly-featured-events.query';
import { GetWeekendEventsQuery } from '../queries/impl/get-weekend-events.query';
import { GetEventLandingQuery } from '../queries/impl/get-event-landing.query';
import { GetEventDetailQuery } from '../queries/impl/get-event-detail.query';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS, REDIS_DEFAULT_TTL } from '@modules/redis/redis.constants';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { matchResult } from '@common/http/match-result';
import { plainToInstance } from 'class-transformer';
import { EventStatusCronService } from '../services/event-status-cron.service';
import { EventSeederService } from '../services/event-seeder.service';
import { SeedEventsRequestDto } from '../dto/seed-events.request.dto';
import { SeedEventsResponseDto } from '../dto/seed-events.response.dto';
import { AdminKeyGuard } from '@common/guards/admin-key.guard';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly redisService: RedisService,
    private readonly eventStatusCronService: EventStatusCronService,
    private readonly eventSeederService: EventSeederService,
  ) { }

  @Get('featured')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener eventos destacados para el Hero Carousel de portada (Caché Redis 12h)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de hasta 5 eventos estelares para la cabecera (desde Redis o BD)',
    type: [FeaturedEventResponseDto],
  })
  async getFeatured(): Promise<FeaturedEventResponseDto[]> {
    return this.queryBus.execute(new GetFeaturedEventsQuery());
  }

  @Post('featured/cache/purge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidar la caché de Redis del Hero Carousel y recrearla inmediatamente' })
  @ApiResponse({
    status: 200,
    description: 'Caché invalidada y regenerada en caliente con nuevo TTL de 12 horas',
    type: PurgeFeaturedCacheResponseDto,
  })
  async purgeAndRecreateFeaturedCache(): Promise<PurgeFeaturedCacheResponseDto> {
    // 1. Eliminar la clave previa en Redis (carpeta qph:home:hero)
    const purged = await this.redisService.del(REDIS_CACHE_KEYS.HOME.HERO);

    // 2. Recrear en caliente forzando consulta a PostgreSQL (skipCache = true guarda en Redis automáticamente)
    const freshEvents: FeaturedEventResponseDto[] = await this.queryBus.execute(
      new GetFeaturedEventsQuery(5, true),
    );

    return plainToInstance(
      PurgeFeaturedCacheResponseDto,
      {
        purged,
        recreated: true,
        count: freshEvents.length,
        cacheKey: REDIS_CACHE_KEYS.HOME.HERO,
        ttlSeconds: REDIS_DEFAULT_TTL.FEATURED_EVENTS_SECONDS,
        message: 'Caché de eventos destacados invalidada y recreada exitosamente en Redis (qph:home:hero) con nuevo TTL de 12 horas.',
      },
      { excludeExtraneousValues: true },
    );
  }

  @Delete('featured/cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar a demanda la clave de caché de eventos destacados en Redis' })
  @ApiResponse({
    status: 200,
    description: 'Clave eliminada de Redis',
    type: PurgeFeaturedCacheResponseDto,
  })
  async deleteFeaturedCache(): Promise<PurgeFeaturedCacheResponseDto> {
    const purged = await this.redisService.del(REDIS_CACHE_KEYS.HOME.HERO);

    return plainToInstance(
      PurgeFeaturedCacheResponseDto,
      {
        purged,
        recreated: false,
        count: 0,
        cacheKey: REDIS_CACHE_KEYS.HOME.HERO,
        ttlSeconds: 0,
        message: purged
          ? 'Caché de eventos destacados (qph:home:hero) eliminada de Redis correctamente.'
          : 'No había clave de eventos destacados en Redis o ya estaba vacía.',
      },
      { excludeExtraneousValues: true },
    );
  }

  @Get('upcoming')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener próximos eventos ordenados cronológicamente (Caché Redis: qph:home:upcoming)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de eventos próximos para la sección Home',
    type: [HomeEventCardResponseDto],
  })
  async getUpcoming(): Promise<HomeEventCardResponseDto[]> {
    return this.queryBus.execute(new GetUpcomingEventsQuery());
  }

  @Get('weekly-featured')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener eventos destacados de la semana (Caché Redis: qph:home:weekly_featured)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de eventos destacados semanales para la sección Home',
    type: [HomeEventCardResponseDto],
  })
  async getWeeklyFeatured(): Promise<HomeEventCardResponseDto[]> {
    return this.queryBus.execute(new GetWeeklyFeaturedEventsQuery());
  }

  @Get('weekend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener planes para el fin de semana (Caché Redis: qph:home:weekend)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de eventos para el fin de semana para la sección Home',
    type: [HomeEventCardResponseDto],
  })
  async getWeekend(): Promise<HomeEventCardResponseDto[]> {
    return this.queryBus.execute(new GetWeekendEventsQuery());
  }

  @Get('landing/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener configuración enriquecida de Landing Page por slug (Caché Redis: qph:events:landing:{slug})' })
  @ApiResponse({
    status: 200,
    description: 'Configuración visual, zonas y contenido del Landing del evento',
    type: EventLandingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Evento no encontrado o no tiene landing habilitada' })
  async getLanding(@Param('slug') slug: string): Promise<EventLandingResponseDto> {
    return this.queryBus.execute(new GetEventLandingQuery(slug));
  }

  @Post('home/cache/purge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidar todas las cachés de la Home (qph:home:*) y regenerarlas en caliente' })
  @ApiResponse({
    status: 200,
    description: 'Todas las secciones de la Home invalidadas y repobladas en Redis',
  })
  async purgeAndRecreateHomeCache() {
    // 1. Borrar todas las claves bajo la carpeta qph:home:*
    const deletedCount = await this.redisService.delPattern('qph:home:*');

    // 2. Precalentar en caliente en paralelo para máxima velocidad
    const [hero, upcoming, weekly, weekend] = await Promise.all([
      this.queryBus.execute(new GetFeaturedEventsQuery(5, true)),
      this.queryBus.execute(new GetUpcomingEventsQuery(8, true)),
      this.queryBus.execute(new GetWeeklyFeaturedEventsQuery(8, true)),
      this.queryBus.execute(new GetWeekendEventsQuery(8, true)),
    ]);

    return {
      success: true,
      deletedKeysCount: deletedCount,
      recreated: {
        heroCount: (hero as any[]).length,
        upcomingCount: (upcoming as any[]).length,
        weeklyFeaturedCount: (weekly as any[]).length,
        weekendCount: (weekend as any[]).length,
      },
      message: 'Todas las secciones de la Home (qph:home:*) fueron invalidadas y precalentadas en Redis exitosamente.',
    };
  }

  @Get(':identifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener detalle público completo de un evento por ID, UUID o slug (Caché Redis: qph:events:detail:{identifier})' })
  @ApiResponse({
    status: 200,
    description: 'Detalle del evento con recintos, funciones y zonas con tarifas activas',
    type: EventDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Evento no encontrado o no publicado' })
  async getDetail(
    @Param('identifier') identifier: string,
    @Query('skipCache') skipCache?: string,
  ): Promise<EventDetailResponseDto> {
    return this.queryBus.execute(new GetEventDetailQuery(identifier, skipCache === 'true'));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo evento en estado borrador (draft)' })
  @ApiResponse({ status: 201, description: 'Evento creado exitosamente como borrador' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEventDto,
  ) {
    const publicUuid = req.user?.sub as string;
    const result = await this.commandBus.execute(new CreateEventCommand(publicUuid, dto));
    return matchResult(
      result,
      (event) => event,
    );
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publicar un evento (requiere correo verificado del organizador)' })
  @ApiResponse({ status: 200, description: 'Evento publicado y puesto en venta exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Debes verificar tu correo antes de publicar el evento' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async publish(
    @Req() req: AuthenticatedRequest,
    @Param('id') eventIdentifier: string,
  ) {
    const publicUuid = req.user?.sub as string;
    const result = await this.commandBus.execute(new PublishEventCommand(publicUuid, eventIdentifier));
    return matchResult(
      result,
      (event) => event,
      {
        EMAIL_NOT_VERIFIED: 'Debes confirmar tu correo electrónico antes de poder publicar un evento.',
        FORBIDDEN: 'No tienes permisos para publicar este evento.',
        NOT_FOUND: 'Evento no encontrado.',
      },
    );
  }

  @Post('admin/sync-expired-status')
  @UseGuards(AdminKeyGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ejecutar manualmente la sincronización de shows y eventos vencidos (Cron de 1:00 AM) [Requiere x-admin-key o admin]' })
  @ApiResponse({ status: 200, description: 'Sincronización manual ejecutada exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso restringido a administradores' })
  async syncExpiredStatus() {
    return this.eventStatusCronService.syncExpiredShowsAndEvents();
  }

  @Post('admin/seed')
  @UseGuards(AdminKeyGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Carga masiva de eventos de prueba (definir cantidad por query o body) [Requiere x-admin-key o admin]',
    description: 'Genera N eventos de prueba completos (con funciones pasadas, de hoy y futuras, zonas, preventas y fotos). Sincroniza MeiliSearch y purga Redis.',
  })
  @ApiResponse({
    status: 201,
    description: 'Eventos generados exitosamente con sus relaciones completas',
    type: SeedEventsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Acceso restringido a administradores' })
  async seedEvents(
    @Query() queryDto: SeedEventsRequestDto,
    @Body() bodyDto?: SeedEventsRequestDto,
  ): Promise<SeedEventsResponseDto> {
    const rawCount = bodyDto?.count ?? queryDto?.count ?? 10;
    const count = Number(rawCount) || 10;
    const result = await this.eventSeederService.seedEvents(count);
    return plainToInstance(SeedEventsResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }
}

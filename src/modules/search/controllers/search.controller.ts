import { Controller, Get, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { SearchEventsRequestDto } from '../dto/search-events.request.dto';
import { SearchEventsResponseDto } from '../dto/search-events.response.dto';
import { PublishedCityResponseDto } from '../dto/published-city.response.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('cities')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener ciudades que cuentan con eventos en estado published' })
  @ApiResponse({
    status: 200,
    description: 'Listado dinámico de ciudades con eventos publicados y conteo activo',
    type: [PublishedCityResponseDto],
  })
  async getPublishedCities(): Promise<PublishedCityResponseDto[]> {
    return this.searchService.getPublishedCities();
  }

  @Get('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Búsqueda instantánea de cartelera de eventos con Meilisearch' })
  @ApiResponse({
    status: 200,
    description: 'Resultados de eventos encontrados en milisegundos',
    type: SearchEventsResponseDto,
  })
  async searchEvents(@Query() query: SearchEventsRequestDto): Promise<SearchEventsResponseDto> {
    return this.searchService.searchEvents(query);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reindexar y sincronizar todos los eventos de PostgreSQL a Meilisearch' })
  @ApiResponse({ status: 200, description: 'Resultado de la sincronización masiva' })
  async syncEvents() {
    const result = await this.searchService.syncAllEvents();
    return {
      success: true,
      message: `Se sincronizaron ${result.indexedCount} de ${result.totalFound} eventos en Meilisearch.`,
      ...result,
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estado del motor de búsqueda' })
  @ApiResponse({ status: 200, description: 'Estado actual del motor de búsqueda' })
  checkHealth() {
    return {
      status: this.searchService.isReady() ? 'available' : 'unavailable',
      healthy: this.searchService.isReady(),
    };
  }
}


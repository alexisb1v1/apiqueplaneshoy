import { EventEntity } from '@events/domain/entities/event.entity';
import { HomeEventCardResponseDto, UrgencyBadgeDto } from '../dto/home-event-card.response.dto';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { plainToInstance } from 'class-transformer';

/**
 * Mapea una entidad EventEntity al DTO optimizado HomeEventCardResponseDto
 * calculando precios mínimos, próxima función, badges de entrada y urgencia de aforo.
 */
export function mapEventToHomeCard(event: EventEntity): HomeEventCardResponseDto {
  // 1. Imagen de Portada
  const banner = event.images?.find((img) => img.imageType === 'banner') || event.images?.[0];

  // 2. Próxima Función (prioriza funciones futuras)
  const now = new Date();
  const sortedShows = (event.shows || []).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const futureShow = sortedShows.find((s) => new Date(s.startTime) >= now);
  const selectedShow = futureShow || sortedShows[0];
  const date = selectedShow?.startTime
    ? new Date(selectedShow.startTime).toISOString()
    : (event.createdAt ? event.createdAt.toISOString() : null);

  // 3. Ubicación y Ciudad
  const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
  const city = (cityInfo.name && cityInfo.name !== 'Perú' ? cityInfo.name : event.venue || 'LIMA').toUpperCase();

  // 4. Precio Mínimo de Entrada
  const prices = (event.zones || [])
    .map((z) => Number(z.regularPrice))
    .filter((p) => !isNaN(p) && p >= 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

  // 5. Tipo de Entrada y Estilo de Badge
  let ticketType = 'GENERAL';
  let ticketBadgeStyle: 'general' | 'vip' | 'platinum' | 'error' = 'general';

  const onlyNames = (event.zones || []).map((z) => (z.name || '').toUpperCase());
  if (onlyNames.some((name) => name.includes('PLATINUM') || name.includes('PLATINO'))) {
    ticketType = 'PLATINUM';
    ticketBadgeStyle = 'platinum';
  } else if (onlyNames.some((name) => name.includes('VIP') || name.includes('BOX'))) {
    ticketType = 'VIP DISPONIBLE';
    ticketBadgeStyle = 'vip';
  } else if (onlyNames.length > 0 && onlyNames[0]) {
    ticketType = onlyNames[0];
    ticketBadgeStyle = 'general';
  }

  // 6. Cálculo Dinámico de Urgencia Basado en Aforo Real
  let totalCapacity = 0;
  let totalSold = 0;
  let totalLocked = 0;
  let vipRemaining = Infinity;

  for (const zone of event.zones || []) {
    const cap = Number(zone.capacity) || 0;
    const sold = Number(zone.soldCount) || 0;
    const locked = Number(zone.lockedCount) || 0;
    totalCapacity += cap;
    totalSold += sold;
    totalLocked += locked;

    const zUpper = `${zone.name} ${zone.title || ''}`.toUpperCase();
    if (zUpper.includes('VIP') || zUpper.includes('PLATINUM')) {
      const zRemaining = Math.max(0, cap - sold - locked);
      if (zRemaining < vipRemaining) {
        vipRemaining = zRemaining;
      }
    }
  }

  const remaining = Math.max(0, totalCapacity - totalSold - totalLocked);
  const soldPercentage = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

  let urgencyBadge: UrgencyBadgeDto;

  if (totalCapacity > 0 && remaining <= 0) {
    urgencyBadge = {
      text: 'Entradas agotadas',
      type: 'critical',
      icon: 'hourglass_top',
    };
    ticketBadgeStyle = 'error';
  } else if (totalCapacity > 0 && remaining <= 60) {
    urgencyBadge = {
      text: `Últimas ${remaining} entradas`,
      type: 'critical',
      icon: 'hourglass_top',
    };
  } else if (soldPercentage >= 80) {
    urgencyBadge = {
      text: 'Alta demanda • Quedan pocas',
      type: 'high_demand',
      icon: 'local_fire_department',
    };
  } else if (vipRemaining <= 25) {
    urgencyBadge = {
      text: 'Zona VIP casi agotada',
      type: 'warning',
      icon: 'stars',
    };
  } else {
    urgencyBadge = {
      text: 'Aforo limitado',
      type: 'info',
      icon: 'bolt',
    };
  }

  return plainToInstance(
    HomeEventCardResponseDto,
    {
      id: event.id.toString(),
      publicUuid: event.publicUuid,
      slug: event.slug,
      hasLandingPage: event.hasLandingPage,
      title: event.name,
      category: event.category,
      imageUrl: banner?.imageUrl || null,
      date,
      city,
      venue: event.venue,
      description: event.description,
      minPrice,
      ticketType,
      ticketBadgeStyle,
      urgencyBadge,
    },
    { excludeExtraneousValues: true },
  );
}


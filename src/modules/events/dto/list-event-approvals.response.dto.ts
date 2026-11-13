import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

export class EventApprovalZoneDto {
  @ApiProperty({ example: 'VIP', description: 'Nombre de la zona' })
  @Expose()
  name: string;

  @ApiProperty({ example: 150.0, description: 'Precio regular de taquilla' })
  @Expose()
  regularPrice: number;

  @ApiProperty({ example: 12.0, description: 'Comisión oficial asignada de ticketera' })
  @Expose()
  serviceFee: number;

  @ApiProperty({ example: false, description: 'Indica si la comisión está incluida en el precio' })
  @Expose()
  feeIncluded: boolean;

  @ApiProperty({ example: 500, description: 'Aforo de la zona' })
  @Expose()
  capacity: number;
}

@Exclude()
export class EventApprovalSummaryDto {
  @ApiProperty({ example: '105', description: 'ID interno del evento' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'UUID público' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ example: 'festival-cumbia-all-stars-2026', description: 'Slug del evento' })
  @Expose()
  slug: string;

  @ApiProperty({ example: 'Festival Cumbia All Stars 2026', description: 'Título comercial' })
  @Expose()
  title: string;

  @ApiProperty({ example: 'CONCERTS', description: 'Categoría' })
  @Expose()
  category: string;

  @ApiProperty({ example: 'in_review', description: 'Estado: draft, in_review, published, observed' })
  @Expose()
  status: string;

  @ApiPropertyOptional({ example: 'Falta adjuntar contrato de recinto', description: 'Motivo de observación si aplica' })
  @Expose()
  observationReason: string | null;

  @ApiPropertyOptional({ example: 'Explanada Olguín - Jockey Club', description: 'Nombre del recinto' })
  @Expose()
  venue: string | null;

  @ApiProperty({ example: 'Lima', description: 'Ciudad / Departamento derivado de ubigeo' })
  @Expose()
  city: string;

  @ApiProperty({ example: 'Entretenimiento Viva SAC', description: 'Nombre o razón social del organizador' })
  @Expose()
  organizerName: string;

  @ApiPropertyOptional({ example: '20601984210', description: 'RUC o documento del organizador' })
  @Expose()
  organizerDocumentNumber: string | null;

  @ApiPropertyOptional({ example: '2026-11-14T20:00:00Z', description: 'Fecha y hora del primer show' })
  @Expose()
  firstShowDate: string | null;

  @ApiProperty({ example: 12500, description: 'Aforo total sumado de todas las zonas' })
  @Expose()
  totalCapacity: number;

  @ApiProperty({ example: 65.0, description: 'Precio regular mínimo de zonas' })
  @Expose()
  minPrice: number;

  @ApiProperty({ example: 280.0, description: 'Precio regular máximo de zonas' })
  @Expose()
  maxPrice: number;

  @ApiProperty({ type: () => [EventApprovalZoneDto], description: 'Zonas y tarifario del evento' })
  @Expose()
  @Type(() => EventApprovalZoneDto)
  zones: EventApprovalZoneDto[];

  @ApiProperty({ example: '2026-11-12T10:00:00Z', description: 'Fecha de creación' })
  @Expose()
  createdAt: string;
}

@Exclude()
export class EventApprovalsMetaDto {
  @ApiProperty({ example: 12, description: 'Total de eventos en este filtro' })
  @Expose()
  total: number;

  @ApiProperty({ example: 1, description: 'Página actual' })
  @Expose()
  page: number;

  @ApiProperty({ example: 10, description: 'Límite por página' })
  @Expose()
  limit: number;

  @ApiProperty({ example: 2, description: 'Total de páginas calculadas' })
  @Expose()
  totalPages: number;

  @ApiProperty({ example: 12, description: 'Conteo total pendientes de revisión' })
  @Expose()
  pendingCount: number;

  @ApiProperty({ example: 45, description: 'Conteo total publicados/aprobados' })
  @Expose()
  publishedCount: number;

  @ApiProperty({ example: 3, description: 'Conteo total observados' })
  @Expose()
  observedCount: number;
}

@Exclude()
export class ListEventApprovalsResponseDto {
  @ApiProperty({ type: () => [EventApprovalSummaryDto] })
  @Expose()
  @Type(() => EventApprovalSummaryDto)
  data: EventApprovalSummaryDto[];

  @ApiProperty({ type: () => EventApprovalsMetaDto })
  @Expose()
  @Type(() => EventApprovalsMetaDto)
  meta: EventApprovalsMetaDto;
}


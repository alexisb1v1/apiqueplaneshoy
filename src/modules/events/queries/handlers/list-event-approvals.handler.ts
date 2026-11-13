import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ok, Result } from 'neverthrow';
import { AppError } from '@common/errors/app-errors';
import { ListEventApprovalsQuery } from '../impl/list-event-approvals.query';
import {
  ListEventApprovalsResponseDto,
  EventApprovalSummaryDto,
  EventApprovalsMetaDto,
} from '@events/dto/list-event-approvals.response.dto';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';

@QueryHandler(ListEventApprovalsQuery)
export class ListEventApprovalsHandler
  implements IQueryHandler<ListEventApprovalsQuery, Result<ListEventApprovalsResponseDto, AppError>>
{
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    query: ListEventApprovalsQuery,
  ): Promise<Result<ListEventApprovalsResponseDto, AppError>> {
    const { status = 'in_review', search, page = 1, limit = 10 } = query.dto;
    const offset = (page - 1) * limit;

    // 1. Conteo de métricas rápidas (sin scan de texto)
    const metricsRaw = await this.dataSource.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('in_review', 'draft', 'pending')) AS "pendingCount",
        COUNT(*) FILTER (WHERE status = 'published') AS "publishedCount",
        COUNT(*) FILTER (WHERE status = 'observed') AS "observedCount"
      FROM events
    `);

    const pendingCount = Number(metricsRaw[0]?.pendingCount || 0);
    const publishedCount = Number(metricsRaw[0]?.publishedCount || 0);
    const observedCount = Number(metricsRaw[0]?.observedCount || 0);

    // 2. Condición de filtro por estado
    let statusCondition = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (status === 'in_review' || status === 'pending') {
      statusCondition = `e.status IN ('in_review', 'draft', 'pending')`;
    } else if (status === 'published') {
      statusCondition = `e.status = 'published'`;
    } else if (status === 'observed') {
      statusCondition = `e.status = 'observed'`;
    } else {
      statusCondition = `1=1`;
    }

    // 3. Condición de búsqueda optimizada con GIN Trigrams
    let searchCondition = '';
    if (search && search.trim().length > 0) {
      queryParams.push(`%${search.trim().toLowerCase()}%`);
      searchCondition = `AND (
        LOWER(e.name) LIKE $${paramIndex} 
        OR (e.venue IS NOT NULL AND LOWER(e.venue) LIKE $${paramIndex})
        OR LOWER(COALESCE(u.organizer_name, u.name)) LIKE $${paramIndex}
      )`;
      paramIndex++;
    }

    // 4. Conteo total filtrado
    const countSql = `
      SELECT COUNT(e.id) AS total
      FROM events e
      INNER JOIN users u ON u.id = e.organizer_id
      WHERE ${statusCondition} ${searchCondition}
    `;
    const countRes = await this.dataSource.query(countSql, queryParams);
    const total = Number(countRes[0]?.total || 0);

    // 5. Consulta LIGERA paginada: Únicamente columnas esenciales para tabla
    queryParams.push(limit);
    const limitIdx = paramIndex++;
    queryParams.push(offset);
    const offsetIdx = paramIndex++;

    const dataSql = `
      SELECT 
        e.id,
        e.public_uuid AS "publicUuid",
        e.slug,
        e.name AS "title",
        e.category,
        e.status,
        e.observation_reason AS "observationReason",
        e.venue,
        e.ubigeo_code AS "ubigeoCode",
        e.created_at AS "createdAt",
        COALESCE(u.organizer_name, u.name) AS "organizerName",
        u.organizer_document_number AS "organizerDocumentNumber",
        (
          SELECT MIN(s.start_time)
          FROM shows s
          WHERE s.event_id = e.id
        ) AS "firstShowDate",
        COALESCE(z_agg.total_capacity, 0)::int AS "totalCapacity",
        COALESCE(z_agg.min_price, 0)::numeric(10,2) AS "minPrice",
        COALESCE(z_agg.max_price, 0)::numeric(10,2) AS "maxPrice",
        COALESCE(z_agg.zones_json, '[]'::json) AS "zonesJson"
      FROM events e
      INNER JOIN users u ON u.id = e.organizer_id
      LEFT JOIN LATERAL (
        SELECT 
          SUM(z.capacity) AS total_capacity,
          MIN(z.regular_price) AS min_price,
          MAX(z.regular_price) AS max_price,
          json_agg(
            json_build_object(
              'name', z.name,
              'regularPrice', z.regular_price::float,
              'serviceFee', COALESCE(z.service_fee, 0)::float,
              'feeIncluded', z.fee_included,
              'capacity', z.capacity
            )
          ) AS zones_json
        FROM zones z
        WHERE z.event_id = e.id
      ) z_agg ON true
      WHERE ${statusCondition} ${searchCondition}
      ORDER BY e.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.dataSource.query(dataSql, queryParams);

    const items: EventApprovalSummaryDto[] = rawRows.map((r: any) => {
      const cityData = resolveCityFromUbigeo(r.ubigeoCode);
      const item = new EventApprovalSummaryDto();
      item.id = String(r.id);
      item.publicUuid = r.publicUuid;
      item.slug = r.slug;
      item.title = r.title;
      item.category = r.category;
      item.status = r.status;
      item.venue = r.venue;
      item.city = cityData.name;
      item.organizerName = r.organizerName;
      item.organizerDocumentNumber = r.organizerDocumentNumber;
      item.firstShowDate = r.firstShowDate ? new Date(r.firstShowDate).toISOString() : null;
      item.totalCapacity = Number(r.totalCapacity || 0);
      item.minPrice = Number(r.minPrice || 0);
      item.maxPrice = Number(r.maxPrice || 0);
      item.observationReason = r.observationReason || null;
      item.zones = Array.isArray(r.zonesJson) ? r.zonesJson : [];
      item.createdAt = new Date(r.createdAt).toISOString();
      return item;
    });

    const totalPages = Math.ceil(total / limit) || 1;

    const meta = new EventApprovalsMetaDto();
    meta.total = total;
    meta.page = page;
    meta.limit = limit;
    meta.totalPages = totalPages;
    meta.pendingCount = pendingCount;
    meta.publishedCount = publishedCount;
    meta.observedCount = observedCount;

    const response = new ListEventApprovalsResponseDto();
    response.data = items;
    response.meta = meta;

    return ok(response);
  }
}


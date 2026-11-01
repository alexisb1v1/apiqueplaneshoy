import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class EventSearchItemDto {
  @Expose()
  id: string;

  @Expose()
  publicUuid: string;

  @Expose()
  title: string;

  @Expose()
  slug: string;

  @Expose()
  description: string | null;

  @Expose()
  category: string;

  @Expose()
  tags: string[];

  @Expose()
  venue: string | null;

  @Expose()
  ubigeoCode: string | null;

  @Expose()
  city: string | null;

  @Expose()
  departmentCode: string | null;

  @Expose()
  minPrice: number;

  @Expose()
  date: string | null;

  @Expose()
  bannerUrl: string | null;

  @Expose()
  hasLandingPage: boolean;
}

@Exclude()
export class SearchEventsResponseDto {
  @Expose()
  hits: EventSearchItemDto[];

  @Expose()
  totalHits: number;

  @Expose()
  processingTimeMs: number;

  @Expose()
  query: string;

  @Expose()
  limit: number;

  @Expose()
  offset: number;
}


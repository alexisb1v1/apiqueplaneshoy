import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ShowEditItemDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiPropertyOptional()
  name?: string;

  @Expose()
  @ApiProperty()
  startTime: string;

  @Expose()
  @ApiPropertyOptional()
  salesEndAt?: string;

  @Expose()
  @ApiPropertyOptional()
  durationHours?: number;

  @Expose()
  @ApiProperty()
  status: string;
}

@Exclude()
export class ZoneTierEditItemDto {
  @Expose()
  @ApiPropertyOptional()
  id?: string;

  @Expose()
  @ApiProperty()
  tierNumber: number;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  price: number;

  @Expose()
  @ApiProperty()
  capacity: number;

  @Expose()
  @ApiPropertyOptional()
  endAt?: string;

  @Expose()
  @ApiPropertyOptional()
  soldCount?: number;
}

@Exclude()
export class ZoneEditItemDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiPropertyOptional()
  publicUuid?: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiPropertyOptional()
  title?: string;

  @Expose()
  @ApiPropertyOptional()
  color?: string;

  @Expose()
  @ApiProperty()
  capacity: number;

  @Expose()
  @ApiProperty()
  regularPrice: number;

  @Expose()
  @ApiPropertyOptional()
  serviceFee?: number;

  @Expose()
  @ApiPropertyOptional()
  feeIncluded?: boolean;

  @Expose()
  @ApiPropertyOptional()
  benefits?: string;

  @Expose()
  @ApiPropertyOptional()
  maxTicketsPerOrder?: number;

  @Expose()
  @ApiPropertyOptional()
  salesStartAt?: string;

  @Expose()
  @ApiPropertyOptional()
  soldCount?: number;

  @Expose()
  @Type(() => ZoneTierEditItemDto)
  @ApiPropertyOptional({ type: [ZoneTierEditItemDto] })
  tiers?: ZoneTierEditItemDto[];
}

@Exclude()
export class CouponEditItemDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  code: string;

  @Expose()
  @ApiProperty()
  discountType: string;

  @Expose()
  @ApiProperty()
  discountValue: number;

  @Expose()
  @ApiProperty()
  usageType: string;

  @Expose()
  @ApiPropertyOptional()
  maxUses?: number;

  @Expose()
  @ApiPropertyOptional()
  usedCount?: number;

  @Expose()
  @ApiPropertyOptional()
  expiresAt?: string;
}

@Exclude()
export class EventImageEditItemDto {
  @Expose()
  @ApiProperty()
  imageUrl: string;

  @Expose()
  @ApiProperty()
  imageType: string;

  @Expose()
  @ApiPropertyOptional()
  sortOrder?: number;
}

@Exclude()
export class OrganizerEventEditResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  publicUuid: string;

  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiPropertyOptional()
  slug?: string;

  @Expose()
  @ApiPropertyOptional()
  description?: string;

  @Expose()
  @ApiProperty()
  category: string;

  @Expose()
  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @Expose()
  @ApiPropertyOptional()
  venue?: string;

  @Expose()
  @ApiPropertyOptional()
  address?: string;

  @Expose()
  @ApiPropertyOptional()
  addressReference?: string;

  @Expose()
  @ApiPropertyOptional()
  ubigeoCode?: string;

  @Expose()
  @ApiPropertyOptional()
  readableLocation?: string;

  @Expose()
  @ApiPropertyOptional()
  coordinates?: string;

  @Expose()
  @ApiPropertyOptional()
  googleMapsUrl?: string;

  @Expose()
  @ApiPropertyOptional()
  ageRestriction?: string;

  @Expose()
  @ApiPropertyOptional()
  userTicketLimit?: number;

  @Expose()
  @ApiPropertyOptional()
  entryRequirements?: string;

  @Expose()
  @ApiPropertyOptional()
  openingHoursComment?: string;

  @Expose()
  @ApiPropertyOptional()
  termsAndConditionsUrl?: string;

  @Expose()
  @ApiPropertyOptional()
  faqs?: Array<{ question: string; answer: string }>;

  @Expose()
  @ApiProperty()
  hasLandingPage: boolean;

  @Expose()
  @ApiPropertyOptional()
  landingConfig?: Record<string, any>;

  @Expose()
  @ApiPropertyOptional()
  promoVideoUrl?: string;

  @Expose()
  @ApiPropertyOptional()
  socialLinks?: {
    instagramUrl?: string;
    facebookUrl?: string;
    tiktokUrl?: string;
  };

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiPropertyOptional()
  bannerUrl?: string;

  @Expose()
  @ApiPropertyOptional()
  zoneMapUrl?: string;

  @Expose()
  @ApiPropertyOptional({ type: [String] })
  galleryUrls?: string[];

  @Expose()
  @Type(() => ShowEditItemDto)
  @ApiPropertyOptional({ type: [ShowEditItemDto] })
  shows?: ShowEditItemDto[];

  @Expose()
  @Type(() => ZoneEditItemDto)
  @ApiPropertyOptional({ type: [ZoneEditItemDto] })
  zones?: ZoneEditItemDto[];

  @Expose()
  @Type(() => CouponEditItemDto)
  @ApiPropertyOptional({ type: [CouponEditItemDto] })
  coupons?: CouponEditItemDto[];

  @Expose()
  @Type(() => EventImageEditItemDto)
  @ApiPropertyOptional({ type: [EventImageEditItemDto] })
  images?: EventImageEditItemDto[];

  @Expose()
  @ApiPropertyOptional()
  organizerName?: string;

  @Expose()
  @ApiPropertyOptional()
  organizerDocumentType?: string;

  @Expose()
  @ApiPropertyOptional()
  organizerDocumentNumber?: string;

  @Expose()
  @ApiPropertyOptional()
  organizerPhone?: string;

  @Expose()
  @ApiPropertyOptional()
  organizerLogoUrl?: string;
}


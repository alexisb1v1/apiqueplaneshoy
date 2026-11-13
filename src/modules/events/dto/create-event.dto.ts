import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Concierto de Rock' })
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @ApiProperty({ example: 'concierto-de-rock-2026', description: 'Slug o URL amigable personalizado para la landing page', required: false })
  @IsString()
  @IsOptional()
  readonly slug?: string;

  @ApiProperty({ example: 'Un concierto increíble en vivo', required: false })
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiProperty({ example: '2026-07-15T20:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  readonly date?: string;

  @ApiProperty({ example: 'Estadio Nacional', required: false })
  @IsString()
  @IsOptional()
  readonly location?: string;

  @ApiProperty({ example: 'Explanada Ferial Yarinacocha', description: 'Nombre comercial del recinto o local', required: false })
  @IsString()
  @IsOptional()
  readonly venue?: string;

  @ApiProperty({ example: 'Selva Central Producciones SAC', description: 'Razón social o nombre comercial del organizador', required: false })
  @IsString()
  @IsOptional()
  readonly organizerName?: string;

  @ApiProperty({ example: 'RUC', enum: ['DNI', 'RUC', 'CE'], description: 'Tipo de documento fiscal del organizador', required: false })
  @IsString()
  @IsOptional()
  readonly organizerDocumentType?: string;

  @ApiProperty({ example: '20601234567', description: 'Número de documento fiscal o RUC', required: false })
  @IsString()
  @IsOptional()
  readonly organizerDocumentNumber?: string;

  @ApiProperty({ example: '+51 987654321', description: 'Teléfono o WhatsApp de contacto comercial', required: false })
  @IsString()
  @IsOptional()
  readonly organizerPhone?: string;

  @ApiProperty({ example: 'https://cdn.queplaneshoy.com/organizers/logo.png', description: 'Logotipo de la productora', required: false })
  @IsString()
  @IsOptional()
  readonly organizerLogoUrl?: string;

  @ApiProperty({ example: 45.5, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  readonly price?: number;

  @ApiProperty({ example: 500, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  readonly capacity?: number;

  @ApiProperty({ example: 'CONCIERTO', required: false })
  @IsString()
  @IsOptional()
  readonly category?: string;

  @ApiProperty({ example: 'https://cdn.queplaneshoy.com/banners/rock.jpg', required: false })
  @IsString()
  @IsOptional()
  readonly bannerUrl?: string;

  @ApiProperty({ example: 'Av. José Pardo 123', required: false })
  @IsString()
  @IsOptional()
  readonly address?: string;

  @ApiProperty({ example: 'Frente al Centro Comercial', required: false })
  @IsString()
  @IsOptional()
  readonly addressReference?: string;

  @ApiProperty({ example: '150101', description: 'Código INEI de ubigeo (6 dígitos)', required: false })
  @IsString()
  @IsOptional()
  readonly ubigeoCode?: string;

  @ApiProperty({ example: '-12.046374, -77.042793', description: 'Coordenadas latitud, longitud', required: false })
  @IsString()
  @IsOptional()
  readonly coordinates?: string;

  @ApiProperty({ example: 'https://maps.google.com/?q=-12.046374,-77.042793', required: false })
  @IsString()
  @IsOptional()
  readonly googleMapsUrl?: string;

  @ApiProperty({ example: ['musica', 'festival', 'pucallpa', 'rock'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  readonly tags?: string[];

  @ApiProperty({ example: 'ALL_AGES', enum: ['ALL_AGES', 'PLUS_14', 'PLUS_18'], required: false })
  @IsString()
  @IsOptional()
  readonly ageRestriction?: string;

  @ApiProperty({ example: 4, default: 4, required: false })
  @IsNumber()
  @IsOptional()
  readonly userTicketLimit?: number;

  @ApiProperty({ example: 'DNI físico obligatorio para el ingreso', required: false })
  @IsString()
  @IsOptional()
  readonly entryRequirements?: string;

  @ApiProperty({ example: 'Apertura de puertas a las 18:00 hrs', required: false })
  @IsString()
  @IsOptional()
  readonly openingHoursComment?: string;

  @ApiProperty({ example: 'https://cdn.queplaneshoy.com/legal/terminos.pdf', required: false })
  @IsString()
  @IsOptional()
  readonly termsAndConditionsUrl?: string;

  @ApiProperty({ example: [{ question: '¿Hay estacionamiento?', answer: 'Sí, gratuito.' }], required: false })
  @IsArray()
  @IsOptional()
  readonly faqs?: Array<{ question: string; answer: string }>;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  readonly hasLandingPage?: boolean;

  @ApiProperty({ example: { header: {}, body: {}, footer: {}, theme: {} }, required: false })
  @IsOptional()
  readonly landingConfig?: Record<string, any>;

  @ApiProperty({ example: 'https://www.youtube.com/watch?v=xxxx', description: 'URL de video promocional o teaser (YouTube, Vimeo o MP4 directo)', required: false })
  @IsString()
  @IsOptional()
  readonly promoVideoUrl?: string;

  @ApiProperty({ example: { instagramUrl: 'https://instagram.com/...', facebookUrl: 'https://facebook.com/...', tiktokUrl: 'https://tiktok.com/@...' }, required: false })
  @IsOptional()
  readonly socialLinks?: {
    instagramUrl?: string;
    facebookUrl?: string;
    tiktokUrl?: string;
  };

  @ApiProperty({ description: 'Funciones u horarios del evento', required: false })
  @IsArray()
  @IsOptional()
  readonly shows?: Array<{
    name?: string;
    startTime: string;
    salesEndAt?: string;
    durationHours?: number;
    endTime?: string;
  }>;

  @ApiProperty({ description: 'Zonas y aforos del evento', required: false })
  @IsArray()
  @IsOptional()
  readonly zones?: Array<{
    name: string;
    title?: string;
    color?: string;
    capacity: number;
    regularPrice: number;
    serviceFee?: number;
    feeIncluded?: boolean;
    benefits?: string;
    maxTicketsPerOrder?: number;
    salesStartAt?: string;
    tiers?: Array<{
      tierNumber?: number;
      name: string;
      price: number;
      capacity: number;
      endAt?: string;
    }>;
  }>;

  @ApiProperty({ description: 'Cupones de descuento iniciales', required: false })
  @IsArray()
  @IsOptional()
  readonly coupons?: Array<{
    code: string;
    discountType: string;
    discountValue: number;
    usageType: string;
    maxUses?: number;
    expiresAt?: string;
  }>;

  @ApiProperty({ description: 'Imágenes del evento', required: false })
  @IsArray()
  @IsOptional()
  readonly images?: Array<{
    imageUrl: string;
    imageType: string;
    sortOrder?: number;
  }>;
}

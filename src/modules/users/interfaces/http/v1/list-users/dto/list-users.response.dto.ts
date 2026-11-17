import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class UserListItemDto {
  @ApiProperty({ example: 42, description: 'ID interno numérico' })
  @Expose()
  id: number;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'UUID público' })
  @Expose()
  publicUuid: string;

  @ApiProperty({ example: 'Valeria Montero Silva', description: 'Nombre completo' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'valeria.m@gmail.com', description: 'Correo electrónico' })
  @Expose()
  email: string;

  @ApiProperty({ example: 'valeriam', description: 'Nombre de usuario único' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'customer', description: 'Rol de usuario' })
  @Expose()
  role: string;

  @ApiProperty({ example: false, description: 'Indica si es organizador' })
  @Expose()
  isOrganizer: boolean;

  @ApiPropertyOptional({ example: 'Sonorama Producciones', description: 'Nombre comercial del organizador' })
  @Expose()
  organizerName: string | null;

  @ApiPropertyOptional({ example: 'DNI', description: 'Tipo de documento' })
  @Expose()
  organizerDocumentType: string | null;

  @ApiPropertyOptional({ example: '72910482', description: 'Número de documento' })
  @Expose()
  organizerDocumentNumber: string | null;

  @ApiPropertyOptional({ example: '+51 984 219 042', description: 'Teléfono de contacto' })
  @Expose()
  organizerPhone: string | null;

  @ApiProperty({ example: true, description: 'Indica si el correo está verificado' })
  @Expose()
  isEmailVerified: boolean;

  @ApiPropertyOptional({ example: '2026-01-12T14:30:00Z', description: 'Fecha de verificación de correo' })
  @Expose()
  emailVerifiedAt: Date | null;

  @ApiProperty({ example: 4, description: 'Cantidad total de tickets comprados por el usuario' })
  @Expose()
  ticketsCount: number;

  @ApiProperty({ example: '2026-01-12T10:00:00Z', description: 'Fecha de registro en la plataforma' })
  @Expose()
  createdAt: Date;
}

@Exclude()
export class ListUsersPaginationMetaDto {
  @ApiProperty({ example: 105, description: 'Total de usuarios que coinciden con los filtros' })
  @Expose()
  total: number;

  @ApiProperty({ example: 1, description: 'Página actual' })
  @Expose()
  page: number;

  @ApiProperty({ example: 10, description: 'Elementos por página' })
  @Expose()
  limit: number;

  @ApiProperty({ example: 11, description: 'Total de páginas calculadas' })
  @Expose()
  totalPages: number;

  @ApiProperty({ example: true, description: 'Indica si existe una página siguiente' })
  @Expose()
  hasNextPage: boolean;

  @ApiProperty({ example: false, description: 'Indica si existe una página anterior' })
  @Expose()
  hasPrevPage: boolean;
}

@Exclude()
export class ListUsersResponseDto {
  @ApiProperty({ type: () => [UserListItemDto], description: 'Lista de usuarios' })
  @Expose()
  @Type(() => UserListItemDto)
  data: UserListItemDto[];

  @ApiProperty({ type: () => ListUsersPaginationMetaDto, description: 'Metadatos de paginación' })
  @Expose()
  @Type(() => ListUsersPaginationMetaDto)
  meta: ListUsersPaginationMetaDto;
}


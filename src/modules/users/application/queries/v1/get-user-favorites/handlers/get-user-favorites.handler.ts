import { Inject, Injectable, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { GetUserFavoritesQuery } from '../get-user-favorites.query';
import { UserFavoriteEventItemResponseDto } from '@users/interfaces/http/v1/favorites/dto/user-favorite-event-item.response.dto';
import { UserFavoriteRepository } from '@users/domain/repositories/user-favorite.repository';
import { AppError } from '@common/errors/app-errors';
// @ts-ignore
import * as ubigeoPeru from 'ubigeo-peru';

@Injectable()
@QueryHandler(GetUserFavoritesQuery)
export class GetUserFavoritesHandler implements IQueryHandler<GetUserFavoritesQuery> {
  private readonly logger = new Logger(GetUserFavoritesHandler.name);

  constructor(
    @Inject('UserFavoriteRepository')
    private readonly favoriteRepository: UserFavoriteRepository,
  ) {}

  async execute(
    query: GetUserFavoritesQuery,
  ): Promise<Result<UserFavoriteEventItemResponseDto[], AppError>> {
    try {
      const favorites = await this.favoriteRepository.getFavoriteEvents(query.userId);

      const items: UserFavoriteEventItemResponseDto[] = favorites
        .filter((fav) => Boolean(fav.event))
        .map((fav) => {
          const event = fav.event;

          // 1. Imagen de portada o banner
          const bannerImage = event.images?.find((img) => img.imageType === 'banner');
          const imageUrl =
            bannerImage?.imageUrl ||
            event.images?.[0]?.imageUrl ||
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDJiDET_y0w7I5zajg5pFTLjyRVXEaEasR-l7QNOnCRxMAHrdgAF5bXUuVsRTbZa9omlnzOKeoMBlFiICbknXsjEoHx8YybyiYawkSld9W42M1OPJteMmnE73Ti34LjnvoYAjV13e_alexDOYTY-zQEPpcO6TBJI1yDqb_pwulxJO2J19aKhIhbFlFKu81DVthNIVRQNXwdm1Wj19T9YTP4dNq0ytLNTqhjk-5Ynu4vKi6WR7nwkDfmaUZ_I3Gc43zFO2yTnDp81DD5';

          // 2. Ciudad por Ubigeo
          let city = 'Perú';
          if (event.ubigeoCode && ubigeoPeru?.reniec) {
            try {
              const info = ubigeoPeru.reniec.find((u: any) => u.departamento === event.ubigeoCode?.slice(0, 2) && u.provincia === event.ubigeoCode?.slice(2, 4));
              if (info) city = info.provincia;
            } catch {
              city = event.addressReference || 'Perú';
            }
          } else if (event.addressReference) {
            city = event.addressReference;
          }

          // 3. Función más próxima
          const now = new Date();
          const upcomingShows = (event.shows || [])
            .map((s) => new Date(s.startTime))
            .filter((d) => d >= now)
            .sort((a, b) => a.getTime() - b.getTime());

          const nextShowDate = upcomingShows[0]?.toISOString() || event.shows?.[0]?.startTime?.toISOString() || null;

          // 4. Precio más bajo
          let minPrice = 0;
          if (event.zones && event.zones.length > 0) {
            const prices = event.zones.map((z) => Number(z.regularPrice || 0)).filter((p) => p > 0);
            if (prices.length > 0) {
              minPrice = Math.min(...prices);
            }
          }

          return {
            id: event.id,
            publicUuid: event.publicUuid,
            slug: event.slug,
            name: event.name,
            category: event.category || 'CONCERTS',
            imageUrl,
            venue: event.venue || event.address || 'Lugar por definir',
            city,
            nextShowDate,
            minPrice,
            favoritedAt: fav.createdAt ? new Date(fav.createdAt).toISOString() : new Date().toISOString(),
          };
        });

      return ok(items);
    } catch (error) {
      this.logger.error(`Error al listar favoritos del usuario: ${(error as Error).message}`);
      return err('INTERNAL_ERROR');
    }
  }
}


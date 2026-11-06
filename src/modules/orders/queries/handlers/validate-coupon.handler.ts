import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ok, err, Result } from 'neverthrow';
import { plainToInstance } from 'class-transformer';
import { AppError } from '@common/errors/app-errors';
import { ValidateCouponQuery } from '../impl/validate-coupon.query';
import { ValidateCouponResponseDto } from '../../dto/validate-coupon.response.dto';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { EventEntity } from '@events/domain/entities/event.entity';

@QueryHandler(ValidateCouponQuery)
export class ValidateCouponHandler
  implements IQueryHandler<ValidateCouponQuery, Result<ValidateCouponResponseDto, AppError>> {
  private readonly logger = new Logger(ValidateCouponHandler.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(
    query: ValidateCouponQuery,
  ): Promise<Result<ValidateCouponResponseDto, AppError>> {
    const { dto } = query;
    const now = new Date();
    const normalizedCode = (dto.code || '').trim().toUpperCase();

    if (!normalizedCode) {
      return err('INVALID_INPUT');
    }

    // 1. Resolver evento titular (por ID numérico, publicUuid o slug)
    const isEventNumeric = /^\d+$/.test(String(dto.eventId));
    const isEventUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(dto.eventId));
    const eventWhere = isEventNumeric
      ? { id: String(dto.eventId) }
      : isEventUuid
      ? { publicUuid: String(dto.eventId) }
      : { slug: String(dto.eventId) };

    const eventRepo = this.dataSource.getRepository(EventEntity);
    const event = await eventRepo.findOne({ where: eventWhere });

    if (!event) {
      this.logger.warn(`[Validar Cupón] Evento '${dto.eventId}' no encontrado.`);
      return err('NOT_FOUND');
    }

    // 2. Buscar cupón por evento y código normalizado
    const couponRepo = this.dataSource.getRepository(CouponEntity);
    const coupon = await couponRepo
      .createQueryBuilder('c')
      .where('c.eventId = :eventId', { eventId: event.id })
      .andWhere('UPPER(c.code) = :code', { code: normalizedCode })
      .getOne();

    if (!coupon) {
      this.logger.warn(`[Validar Cupón] Código '${normalizedCode}' no existe en evento ${event.id}.`);
      return err('NOT_FOUND');
    }

    // 3. Evaluar reglas de estado y ciclo de vida (3 casos de uso)
    // Regla base: ¿Está activo?
    if (!coupon.isActive) {
      this.logger.warn(`[Validar Cupón] Código '${normalizedCode}' se encuentra inactivo/pausado.`);
      return err('COUPON_INVALID_OR_EXPIRED');
    }

    // Caso 3: Vigencia por fecha y hora
    if (coupon.startsAt && now < new Date(coupon.startsAt)) {
      this.logger.warn(`[Validar Cupón] Código '${normalizedCode}' aún no inicia vigencia.`);
      return err('COUPON_INVALID_OR_EXPIRED');
    }
    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
      this.logger.warn(`[Validar Cupón] Código '${normalizedCode}' venció el ${coupon.expiresAt}.`);
      return err('COUPON_INVALID_OR_EXPIRED');
    }

    // Caso 1: De una sola vida (single_use)
    if (coupon.usageType === 'single_use' && Number(coupon.usedCount) >= 1) {
      this.logger.warn(`[Validar Cupón] Código de uso único '${normalizedCode}' ya fue consumido.`);
      return err('COUPON_INVALID_OR_EXPIRED');
    }

    // Caso 2: Reusable N veces (reusable con max_uses)
    if (
      coupon.usageType === 'reusable' &&
      coupon.maxUses !== null &&
      Number(coupon.usedCount) >= Number(coupon.maxUses)
    ) {
      this.logger.warn(
        `[Validar Cupón] Código '${normalizedCode}' alcanzó su límite de ${coupon.maxUses} canjes.`,
      );
      return err('COUPON_INVALID_OR_EXPIRED');
    }

    // Validar monto mínimo requerido
    const subtotal = Number(dto.subtotal) || 0;
    if (coupon.minOrderAmount !== null && subtotal < Number(coupon.minOrderAmount)) {
      this.logger.warn(
        `[Validar Cupón] Subtotal ${subtotal} no alcanza el mínimo de ${coupon.minOrderAmount}.`,
      );
      return err('INVALID_INPUT');
    }

    // 4. Calcular descuento según modalidad (2 tipos de cálculo: % vs Fijo)
    const discountVal = Number(coupon.discountValue) || 0;
    let discountAmount = 0;
    let message = '';

    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * (discountVal / 100)) * 100) / 100;
      message = `Cupón aplicado correctamente (-${discountVal}%)`;
    } else {
      // Monto fijo en soles con candado piso 0
      discountAmount = Math.min(subtotal, discountVal);
      message = `Cupón aplicado correctamente (-S/ ${discountVal.toFixed(2)})`;
    }

    const newTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    const response = plainToInstance(
      ValidateCouponResponseDto,
      {
        code: coupon.code.toUpperCase(),
        discountType: coupon.discountType === 'percentage' ? 'percentage' : 'fixed',
        discountValue: discountVal,
        discountAmount,
        newTotal,
        message,
      },
      { excludeExtraneousValues: true },
    );

    return ok(response);
  }
}


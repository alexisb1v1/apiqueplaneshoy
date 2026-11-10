import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, AuthenticatedRequest } from '@auth/infrastructure/guards/jwt-auth.guard';
import { matchResult } from '@common/http/match-result';
import { PrepareCulqiCheckoutRequestDto } from '../dto/prepare-culqi-checkout.request.dto';
import { PrepareCulqiCheckoutResponseDto } from '../dto/prepare-culqi-checkout.response.dto';
import { ConfirmCulqiChargeRequestDto } from '../dto/confirm-culqi-charge.request.dto';
import { ConfirmCulqiChargeResponseDto } from '../dto/confirm-culqi-charge.response.dto';
import { CulqiOrderStatusResponseDto } from '../dto/culqi-order-status.response.dto';
import { PrepareCulqiCheckoutCommand } from '../commands/impl/prepare-culqi-checkout.command';
import { ConfirmCulqiChargeCommand } from '../commands/impl/confirm-culqi-charge.command';
import { CancelPendingCulqiOrderCommand } from '../commands/impl/cancel-pending-culqi-order.command';
import { GetCulqiOrderStatusQuery } from '../queries/impl/get-culqi-order-status.query';

@ApiTags('Orders - Culqi Multipago')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders/culqi')
export class CulqiOrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('prepare')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Reserva entradas en PostgreSQL y crea la orden oficial en Culqi API v2 para abrir Culqi Checkout Custom (Multipago)',
  })
  @ApiResponse({ status: 201, type: PrepareCulqiCheckoutResponseDto })
  async prepare(
    @Body() body: PrepareCulqiCheckoutRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PrepareCulqiCheckoutResponseDto> {
    const result = await this.commandBus.execute(
      new PrepareCulqiCheckoutCommand(body, Number(req.user?.id)),
    );

    return matchResult(result, (data) => data, {
      TICKET_LIMIT_EXCEEDED:
        'Has superado el límite de entradas permitido para este evento o para esta zona.',
      INVALID_INPUT:
        'No hay aforo suficiente disponible o el monto mínimo cobrable (S/ 1.00) no se cumple.',
      COUPON_INVALID_OR_EXPIRED:
        'El cupón de descuento ingresado no es válido o ha caducado.',
      GATEWAY_NOT_CONFIGURED:
        'Las credenciales de Culqi aún no están configuradas en el servidor.',
    });
  }

  @Post('confirm-charge')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Ejecuta el cargo en Culqi API v2 con el token generado (Tarjeta o Yape) y soporte 3D Secure',
  })
  @ApiResponse({ status: 200, type: ConfirmCulqiChargeResponseDto })
  async confirmCharge(
    @Body() body: ConfirmCulqiChargeRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ConfirmCulqiChargeResponseDto> {
    const result = await this.commandBus.execute(
      new ConfirmCulqiChargeCommand(body, Number(req.user?.id)),
    );

    return matchResult(result, (data) => data, {
      PAYMENT_REJECTED:
        'El pago fue rechazado por tu banco o emisor. Verifica tus datos o prueba con otro método de pago.',
      ORDER_EXPIRED:
        'Tu reserva expiró antes de completar el pago. Por favor inicia una nueva compra.',
      COUPON_INVALID_OR_EXPIRED:
        'El cupón vinculado ya expiró o agotó sus canjes disponibles. Retira el cupón e intenta nuevamente.',
      GATEWAY_NOT_CONFIGURED:
        'Las credenciales de Culqi aún no están configuradas en el servidor.',
    });
  }

  @Get('status/:orderPublicUuid')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Consulta y sincroniza en vivo el estado de una orden Culqi (ideal para QR Billeteras, PagoEfectivo CIP y Cuotéalo)',
  })
  @ApiResponse({ status: 200, type: CulqiOrderStatusResponseDto })
  async getStatus(
    @Param('orderPublicUuid', ParseUUIDPipe) orderPublicUuid: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<CulqiOrderStatusResponseDto> {
    const result = await this.queryBus.execute(
      new GetCulqiOrderStatusQuery(orderPublicUuid, Number(req.user?.id)),
    );

    return matchResult(result, (data) => data);
  }

  @Post('cancel/:orderPublicUuid')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Libera una orden pendiente cuando el comprador cierra voluntariamente el modal de Culqi sin pagar',
  })
  async cancelPending(
    @Param('orderPublicUuid', ParseUUIDPipe) orderPublicUuid: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ released: boolean; status: string }> {
    const result = await this.commandBus.execute(
      new CancelPendingCulqiOrderCommand(orderPublicUuid, Number(req.user?.id)),
    );

    return matchResult(result, (data) => data);
  }
}


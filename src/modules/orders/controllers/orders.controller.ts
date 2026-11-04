import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Inject,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TokenService } from '@auth/domain/ports/token-service.port';
import { SimulateOrderCheckoutRequestDto } from '../dto/simulate-order-checkout.request.dto';
import { SimulateOrderCheckoutResponseDto } from '../dto/simulate-order-checkout.response.dto';
import { UserOrderResponseDto } from '../dto/user-order.response.dto';
import { SimulateOrderCheckoutCommand } from '../commands/impl/simulate-order-checkout.command';
import { GetMyOrdersQuery } from '../queries/impl/get-my-orders.query';
import { matchResult } from '@common/http/match-result';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject('TokenService')
    private readonly tokenService: TokenService,
  ) {}

  @Post('simulate-checkout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Simular el pago de una orden mediante pasarela (con aleatoriedad de éxito/fallo) y registrar orden, pago y tickets en BD para el usuario en sesión',
  })
  @ApiResponse({
    status: 201,
    description: 'Orden pagada exitosamente y tickets emitidos en PostgreSQL',
    type: SimulateOrderCheckoutResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Transacción simulada rechazada (fondos insuficientes o fallo bancario) o stock no disponible',
  })
  async simulateCheckout(
    @Body() body: SimulateOrderCheckoutRequestDto,
    @Req() req: any,
  ): Promise<SimulateOrderCheckoutResponseDto> {
    let authenticatedUserId: number | undefined = undefined;

    // 1. Extraer usuario autenticado si se proporciona token Bearer en el encabezado
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = this.tokenService.verifyToken(token);
      if (payload && payload.id) {
        authenticatedUserId = Number(payload.id);
      }
    }

    // 2. Si req.user ya estuviera poblado por algún middleware previo
    if (!authenticatedUserId && req.user?.id) {
      authenticatedUserId = Number(req.user.id);
    }

    if (!authenticatedUserId) {
      throw new UnauthorizedException(
        'Debes iniciar sesión con tu cuenta para poder comprar y emitir tus entradas oficiales.',
      );
    }

    const result = await this.commandBus.execute(
      new SimulateOrderCheckoutCommand(body, authenticatedUserId),
    );

    return matchResult(result, (data) => data, {
      PAYMENT_REJECTED:
        'La transacción ha sido rechazada por la pasarela de pagos (simulación de fallo: Fondos insuficientes o tarjeta declinada). Prueba con otro medio de pago.',
      INVALID_INPUT: 'No hay aforo o stock suficiente disponible para las zonas seleccionadas.',
      TICKET_LIMIT_EXCEEDED:
        'Has superado el límite de entradas permitido para este evento o compra. Revisa tus compras anteriores en tu perfil.',
      NOT_FOUND: 'El evento, función o zona seleccionada no existen o no están vigentes.',
    });
  }

  @Get('my-orders')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Obtener todas las órdenes y entradas compradas por el usuario autenticado (incluye eventos pasados y futuros)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista histórica completa de compras y tickets oficiales emitidos',
    type: [UserOrderResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - se requiere sesión activa del usuario',
  })
  async getMyOrders(@Req() req: any): Promise<UserOrderResponseDto[]> {
    let authenticatedUserId: number | undefined = undefined;

    // Extraer usuario autenticado mediante el token Bearer (Regla DevSecOps BOLA - API1)
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = this.tokenService.verifyToken(token);
      if (payload && payload.id) {
        authenticatedUserId = Number(payload.id);
      }
    }

    if (!authenticatedUserId && req.user?.id) {
      authenticatedUserId = Number(req.user.id);
    }

    if (!authenticatedUserId) {
      throw new UnauthorizedException(
        'Debes iniciar sesión para consultar tus entradas y compras registradas.',
      );
    }

    return this.queryBus.execute(new GetMyOrdersQuery(authenticatedUserId));
  }
}


import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { Result } from 'neverthrow';
import { AppError } from '../errors/app-errors';

const DEFAULT_MESSAGES: Record<AppError, string> = {
  NOT_FOUND: 'Recurso no encontrado',
  ALREADY_EXISTS: 'El recurso ya existe',
  UNAUTHORIZED: 'No autorizado',
  FORBIDDEN: 'Acceso denegado',
  INVALID_INPUT: 'Datos de entrada inválidos',
  INTERNAL_ERROR: 'Error interno del servidor',
  EMAIL_NOT_VERIFIED: 'Debes confirmar tu correo electrónico antes de realizar esta acción',
  PAYMENT_REJECTED: 'Transacción rechazada por la pasarela de pagos. Fondos insuficientes o tarjeta declinada.',
  TICKET_LIMIT_EXCEEDED: 'Has superado el límite de entradas permitido por compra o por evento para este usuario.',
  COUPON_INVALID_OR_EXPIRED: 'El cupón de descuento no es válido, ha expirado o ya no cuenta con usos disponibles.',
  TOKEN_EXPIRED_OR_INVALID: 'El enlace de recuperación es inválido o ha expirado.',
  GATEWAY_NOT_CONFIGURED: 'La pasarela de pagos Culqi aún no se encuentra configurada en el servidor.',
  GATEWAY_ERROR: 'No se pudo establecer comunicación con la pasarela de pagos Culqi. Intenta nuevamente.',
  ORDER_EXPIRED: 'El tiempo de reserva de tu orden ha expirado y las entradas fueron liberadas.',
  EVENT_NOT_FOUND: 'El evento seleccionado no existe o ya no está disponible para compra.',
  SHOW_NOT_FOUND: 'La función seleccionada no existe para este evento o no tiene fechas programadas.',
  ZONE_NOT_FOUND: 'La localidad o zona seleccionada ya no se encuentra disponible. Recarga la página del evento.',
};

export function matchResult<T>(
  result: Result<T, AppError>,
  onSuccess: (data: T) => any,
  messages?: Partial<Record<AppError, string>>,
): any {
  return result.match(onSuccess, (error) => {
    const msg = messages?.[error] ?? DEFAULT_MESSAGES[error];
    switch (error) {
      case 'EVENT_NOT_FOUND':
      case 'SHOW_NOT_FOUND':
      case 'ZONE_NOT_FOUND':
      case 'NOT_FOUND':              throw new NotFoundException(msg);
      case 'ALREADY_EXISTS':         throw new ConflictException(msg);
      case 'UNAUTHORIZED':           throw new UnauthorizedException(msg);
      case 'EMAIL_NOT_VERIFIED':
      case 'FORBIDDEN':              throw new ForbiddenException(msg);
      case 'GATEWAY_NOT_CONFIGURED': throw new ServiceUnavailableException(msg);
      case 'GATEWAY_ERROR':          throw new BadGatewayException(msg);
      case 'PAYMENT_REJECTED':
      case 'TICKET_LIMIT_EXCEEDED':
      case 'COUPON_INVALID_OR_EXPIRED':
      case 'TOKEN_EXPIRED_OR_INVALID':
      case 'ORDER_EXPIRED':
      case 'INVALID_INPUT':          throw new BadRequestException(msg);
      default:                       throw new InternalServerErrorException(msg);
    }
  });
}

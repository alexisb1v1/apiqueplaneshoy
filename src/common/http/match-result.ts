import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
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
};

export function matchResult<T>(
  result: Result<T, AppError>,
  onSuccess: (data: T) => any,
  messages?: Partial<Record<AppError, string>>,
): any {
  return result.match(onSuccess, (error) => {
    const msg = messages?.[error] ?? DEFAULT_MESSAGES[error];
    switch (error) {
      case 'NOT_FOUND':      throw new NotFoundException(msg);
      case 'ALREADY_EXISTS': throw new BadRequestException(msg);
      case 'UNAUTHORIZED':   throw new UnauthorizedException(msg);
      case 'FORBIDDEN':      throw new ForbiddenException(msg);
      case 'INVALID_INPUT':  throw new BadRequestException(msg);
      default:               throw new InternalServerErrorException(msg);
    }
  });
}

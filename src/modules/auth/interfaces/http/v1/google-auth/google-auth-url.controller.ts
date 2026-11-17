import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GetGoogleAuthUrlQuery } from '@auth/application/queries/v1/get-google-auth-url/get-google-auth-url.query';
import { GoogleAuthUrlResponseDto } from './dto/google-auth-url.response.dto';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class GoogleAuthUrlController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('google/url')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Obtener URL oficial OAuth 2.0 de Google con token state anti-CSRF' })
  @ApiQuery({ name: 'redirect', required: false, description: 'Ruta interna opcional tras iniciar sesión' })
  @ApiResponse({
    status: 200,
    description: 'URL de autenticación generada',
    type: GoogleAuthUrlResponseDto,
  })
  @ApiResponse({ status: 503, description: 'Google OAuth no está configurado en el servidor' })
  async execute(@Query('redirect') redirect?: string): Promise<GoogleAuthUrlResponseDto> {
    const result = await this.queryBus.execute(new GetGoogleAuthUrlQuery(redirect));

    return matchResult(result, (response: GoogleAuthUrlResponseDto) => response, {
      GATEWAY_NOT_CONFIGURED:
        'El inicio de sesión con Google aún no está configurado en el servidor.',
    });
  }
}


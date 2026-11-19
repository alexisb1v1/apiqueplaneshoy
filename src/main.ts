import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Escudo de seguridad HTTP: Oculta cabeceras de Express, previene clickjacking y MIME sniffing
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  const isProduction = process.env.NODE_ENV === 'production';

  const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://queplanhoy.com',
    'https://www.queplanhoy.com',
    'https://central.queplanhoy.com',
    'https://dev.queplanhoy.com',
    'https://centraldev.queplanhoy.com',
  ];

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : defaultOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction &&
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(
          new Error(
            `Bloqueado por política CORS: origen ${origin} no autorizado.`,
          ),
        );
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-origin'],
  });

  const cookieParserMiddleware =
    typeof cookieParser === 'function'
      ? cookieParser
      : (cookieParser as any).default;
  if (typeof cookieParserMiddleware === 'function') {
    app.use(cookieParserMiddleware());
  }

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('API Que Planes Hoy')
      .setDescription(
        'Servicios backend para la aplicación de compra de tickets para eventos',
      )
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();

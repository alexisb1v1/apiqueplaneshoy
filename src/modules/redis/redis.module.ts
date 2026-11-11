import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import { ThrottlerStorageRedisService } from './throttler-storage-redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisClient');
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = Number(configService.get<number>('REDIS_PORT', 6379));
        const password = configService.get<string>('REDIS_PASSWORD') || undefined;

        const redis = new Redis({
          host,
          port,
          password,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2500,
          commandTimeout: 2500,
          retryStrategy(times) {
            // Reintento con backoff exponencial con tope de 5 segundos
            const delay = Math.min(times * 200, 5000);
            return delay;
          },
        });

        redis.on('connect', () => {
          logger.log(`Conexión establecida con Redis en ${host}:${port}`);
        });

        redis.on('ready', () => {
          logger.log('Cliente Redis listo para recibir comandos.');
        });

        redis.on('error', (err) => {
          // Logueamos advertencia para no generar pánico si Redis está caído en entorno local
          logger.warn(`Advertencia en conexión Redis: ${err.message}`);
        });

        // Intentamos conexión inicial sin bloquear el inicio del framework
        redis.connect().catch((err) => {
          logger.warn(`No se pudo conectar inmediatamente a Redis (${host}:${port}): ${err.message}. La aplicación continuará funcionando con fallback directo a la base de datos.`);
        });

        return redis;
      },
    },
    RedisService,
    ThrottlerStorageRedisService,
  ],
  exports: [REDIS_CLIENT, RedisService, ThrottlerStorageRedisService],
})
export class RedisModule { }


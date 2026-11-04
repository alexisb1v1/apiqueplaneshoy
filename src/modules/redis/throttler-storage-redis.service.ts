import { Injectable, Inject, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `qph:ratelimit:${throttlerName}:${key}`;
    const blockKey = `qph:ratelimit:block:${throttlerName}:${key}`;

    try {
      // 1. Verificar si la IP está bloqueada por exceso previo
      const isBlocked = await this.redis.exists(blockKey);
      if (isBlocked) {
        const timeToBlockExpire = await this.redis.pttl(blockKey);
        return {
          totalHits: limit + 1,
          timeToExpire: Math.max(0, timeToBlockExpire),
          isBlocked: true,
          timeToBlockExpire: Math.max(0, timeToBlockExpire),
        };
      }

      // 2. Incrementar atómicamente el contador en Redis
      const totalHits = await this.redis.incr(redisKey);
      let timeToExpire = await this.redis.pttl(redisKey);

      // Si es la primera petición de la ventana, fijar tiempo de expiración
      if (totalHits === 1 || timeToExpire < 0) {
        await this.redis.pexpire(redisKey, ttl);
        timeToExpire = ttl;
      }

      // 3. Si excede el límite y hay penalización de bloqueo configurada
      let blockedNow = false;
      let timeToBlockExpire = 0;
      if (totalHits > limit && blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        blockedNow = true;
        timeToBlockExpire = blockDuration;
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, timeToExpire),
        isBlocked: blockedNow,
        timeToBlockExpire,
      };
    } catch (error) {
      this.logger.warn(`Fallback de Rate Limit por error en Redis: ${error instanceof Error ? error.message : error}`);
      // Degradación elegante: si Redis no responde, permite pasar la petición sin tirar error 500
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
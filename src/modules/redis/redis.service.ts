import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: Redis,
  ) {}

  /**
   * Obtiene un valor parseado desde la caché de Redis.
   * Si no existe o Redis está desconectado, retorna null de forma segura.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn(`Error al leer clave [${key}] desde Redis: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Guarda un valor serializado en JSON en Redis con tiempo de expiración (TTL).
   * @param key Clave única
   * @param value Objeto o valor a guardar
   * @param ttlSeconds Tiempo de vida en segundos (default: 43200 = 12 horas)
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      this.logger.warn(`Error al escribir clave [${key}] en Redis: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Elimina una clave de la caché a demanda.
   */
  async del(key: string): Promise<boolean> {
    try {
      const deleted = await this.client.del(key);
      return deleted > 0;
    } catch (error) {
      this.logger.warn(`Error al eliminar clave [${key}] en Redis: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Elimina claves que coincidan con un patrón (ej: 'qph:cache:events:*').
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.warn(`Error al eliminar patrón [${pattern}] en Redis: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Retorna el tiempo restante de vida (TTL) de una clave en segundos.
   */
  async getTtl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.warn(`Error al consultar TTL de [${key}] en Redis: ${(error as Error).message}`);
      return -1;
    }
  }

  /**
   * Comprueba si el cliente de Redis está conectado y listo.
   */
  isConnected(): boolean {
    return this.client.status === 'ready';
  }

  /**
   * Cierre seguro de conexiones al apagar la aplicación.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.logger.log('Conexión con Redis cerrada correctamente.');
      }
    } catch (error) {
      this.logger.warn(`Error al cerrar conexión de Redis: ${(error as Error).message}`);
    }
  }
}


import { Redis } from '@upstash/redis'

/**
 * Kapsułkujemy Redisa z fallbackiem (mockiem), by aplikacja się kompilowała lokalnie 
 * bez zmiennych środowiskowych Upstash.
 */
class RedisMock {
  private store = new Map<string, any>()
  async get(key: string) { return this.store.get(key) || null }
  async set(key: string, value: any) { this.store.set(key, value); return 'OK' }
  async del(key: string) { this.store.delete(key); return 1 }
}

const isConfigured = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

export const redis = isConfigured 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : new RedisMock() as unknown as Redis

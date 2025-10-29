import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../shared/redis.service';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const windowKey = `${key}:${window}`;

    // Get current count
    const current = await this.redisService.get(windowKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: (window + 1) * windowMs,
      };
    }

    // Increment counter
    await this.redisService.set(windowKey, (count + 1).toString(), Math.ceil(windowMs / 1000));

    return {
      allowed: true,
      remaining: limit - count - 1,
      resetTime: (window + 1) * windowMs,
    };
  }

  async checkApiKeyRateLimit(apiKey: string): Promise<boolean> {
    const limit = this.configService.get<number>('RATE_LIMIT_MAX', 100);
    const window = this.configService.get<number>('RATE_LIMIT_TTL', 60) * 1000;

    const result = await this.checkRateLimit(`api_key:${apiKey}`, limit, window);
    return result.allowed;
  }

  async checkIpRateLimit(ip: string): Promise<boolean> {
    const limit = 100; // 100 requests per minute
    const window = 60 * 1000; // 1 minute

    const result = await this.checkRateLimit(`ip:${ip}`, limit, window);
    return result.allowed;
  }
}

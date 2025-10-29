import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Only try to connect to Redis if REDIS_HOST is explicitly set
    const redisHost = this.configService.get('REDIS_HOST');
    if (!redisHost) {
      console.log('ℹ️ Redis not configured, running without Redis');
      this.client = null;
      return;
    }

    try {
      const redisPort = this.configService.get('REDIS_PORT', 6379);
      const redisPassword = this.configService.get('REDIS_PASSWORD')?.trim();
      
      const redisOptions: any = {
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        connectTimeout: 10000,
        keepAlive: 30000,
        retryStrategy: (times) => {
          // Stop retrying after 3 attempts
          if (times > 3) {
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        showFriendlyErrorStack: true,
        lazyConnect: true,
      };
      
      this.client = new Redis(redisOptions);

      // Set up logging event handlers (non-blocking)
      this.client.on('ready', () => {
        console.log('✅ Redis client ready and authenticated');
      });

      // Connect and wait for ready state
      return new Promise<void>(async (resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (this.client) {
              this.client.removeAllListeners('ready');
              this.client.removeAllListeners('error');
              this.client.removeAllListeners('close');
            }
            reject(new Error('Redis connection timeout after 10 seconds'));
          }
        }, 10000);
        
        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
          }
        };
        
        // Handle connection errors
        this.client.once('error', (err) => {
          if (resolved) return;
          cleanup();
          const errorMsg = err.message || err.toString();
          console.error(`❌ Redis connection error: ${errorMsg}`);
          
          if (errorMsg.includes('NOAUTH') || errorMsg.includes('authentication') || errorMsg.includes('WRONGPASS')) {
            console.error(`   Authentication failed - check if REDIS_PASSWORD matches Redis server password`);
          }
          
          reject(err);
        });
        
        // Handle connection close before ready
        this.client.once('close', () => {
          if (resolved) return;
          if (this.client.status !== 'ready') {
            cleanup();
            reject(new Error('Redis connection closed before authentication'));
          }
        });
        
        // Handle successful connection
        this.client.once('ready', async () => {
          if (resolved) return;
          cleanup();
          try {
            await this.client.ping();
            
            // Set up runtime error handler after successful connection
            this.client.on('error', (err) => {
              if (!err.message.includes('ECONNRESET') && !err.message.includes('ECONNABORTED') && !err.message.includes('Connection is closed')) {
                console.warn(`⚠️ Redis runtime error: ${err.message}`);
              }
            });
            
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        try {
          await this.client.connect();
        } catch (error) {
          if (!resolved) {
            cleanup();
            console.error(`❌ Redis connection error: ${error.message}`);
            reject(error);
          }
        }
      });
    } catch (error) {
      console.warn(`⚠️ Redis connection failed (continuing without Redis): ${error.message}`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) return;
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.client) return;
    await this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.client) {
      console.log(`⚠️  Cannot subscribe to ${channel}: Redis client not available`);
      return;
    }
    
    try {
      // Subscribe to the channel
      await this.client.subscribe(channel);
      console.log(`✅ Subscribed to Redis channel: ${channel}`);
      
      // Listen for messages
      this.client.on('message', (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      console.error(`⚠️  Failed to subscribe to Redis channel ${channel}:`, error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.client) return;
    await this.client.unsubscribe(channel);
  }
}

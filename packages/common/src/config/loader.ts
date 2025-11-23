import { z } from 'zod';

/**
 * Configuration schema validation using Zod
 * This ensures type safety and validates all required config at startup
 */
const ConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
  }),
  database: z.object({
    url: z.string(),
    pool: z.object({
      min: z.number(),
      max: z.number(),
      idleTimeoutMs: z.number(),
    }),
  }),
  auth: z.object({
    jwt: z.object({
      secret: z.string(),
      expiresIn: z.string(),
    }),
  }),
  services: z.object({
    userService: z.object({
      port: z.number(),
    }),
    productService: z.object({
      port: z.number(),
    }),
  }),
  kafka: z.object({
    clientId: z.string(),
    brokers: z.array(z.string()),
    ssl: z.boolean(),
    sasl: z
      .object({
        mechanism: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
    producer: z.object({
      batchSize: z.number(),
      lingerMs: z.number(),
      compressionType: z.string(),
      enableIdempotence: z.boolean(),
    }),
    consumer: z.object({
      sessionTimeoutMs: z.number(),
      heartbeatIntervalMs: z.number(),
      maxPollRecords: z.number(),
      autoOffsetReset: z.enum(['earliest', 'latest']),
      enableAutoCommit: z.boolean(),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    pretty: z.boolean(),
  }),
  metrics: z.object({
    enabled: z.boolean(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Simple configuration loader that prioritizes environment variables
 * Uses a base JSON config file with env var overrides
 */
class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config;
  private env: string;

  private constructor() {
    this.env = process.env.NODE_ENV || 'dev';
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private loadConfig(): Config {
    // Build configuration from environment variables with sensible defaults
    const config = {
      app: {
        name: process.env.APP_NAME || 'cqrs-demo',
        version: process.env.APP_VERSION || '1.0.0',
      },
      database: {
        url: process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/cqrs_demo',
        pool: {
          min: parseInt(process.env.DB_POOL_MIN || '1'),
          max: parseInt(process.env.DB_POOL_MAX || '10'),
          idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '10000'),
        },
      },
      auth: {
        jwt: {
          secret: process.env.JWT_SECRET || 'supersecret-change-me-in-production',
          expiresIn: process.env.JWT_EXPIRES || '1d',
        },
      },
      services: {
        userService: {
          port: parseInt(process.env.USER_SERVICE_PORT || '3101'),
        },
        productService: {
          port: parseInt(process.env.PRODUCT_SERVICE_PORT || '3102'),
        },
      },
      kafka: {
        clientId: process.env.KAFKA_CLIENT_ID || 'cqrs-demo',
        brokers: process.env.KAFKA_BROKERS?.split(',').map(b => b.trim()) || ['localhost:19092'],
        ssl: process.env.KAFKA_SSL === 'true',
        sasl: process.env.KAFKA_USERNAME
          ? {
              mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
              username: process.env.KAFKA_USERNAME,
              password: process.env.KAFKA_PASSWORD,
            }
          : undefined,
        producer: {
          batchSize: parseInt(process.env.KAFKA_PRODUCER_BATCH_SIZE || '16384'),
          lingerMs: parseInt(process.env.KAFKA_PRODUCER_LINGER_MS || '5'),
          compressionType: process.env.KAFKA_PRODUCER_COMPRESSION_TYPE || 'gzip',
          enableIdempotence: process.env.KAFKA_PRODUCER_ENABLE_IDEMPOTENCE !== 'false',
        },
        consumer: {
          sessionTimeoutMs: parseInt(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS || '30000'),
          heartbeatIntervalMs: parseInt(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS || '3000'),
          maxPollRecords: parseInt(process.env.KAFKA_CONSUMER_MAX_POLL_RECORDS || '500'),
          autoOffsetReset:
            (process.env.KAFKA_CONSUMER_AUTO_OFFSET_RESET as 'earliest' | 'latest') || 'earliest',
          enableAutoCommit: process.env.KAFKA_CONSUMER_ENABLE_AUTO_COMMIT !== 'true',
        },
      },
      logging: {
        level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
        pretty: process.env.LOG_PRETTY === 'true',
      },
      metrics: {
        enabled: process.env.METRICS_ENABLED === 'true',
      },
    };

    // Validate configuration with Zod
    return ConfigSchema.parse(config);
  }

  public getConfig(): Config {
    return this.config;
  }

  public getEnvironment(): string {
    return this.env;
  }

  public isDevelopment(): boolean {
    return this.env === 'dev';
  }

  public isStaging(): boolean {
    return this.env === 'staging';
  }

  public isProduction(): boolean {
    return this.env === 'prod';
  }
}

export const configLoader = ConfigLoader.getInstance();

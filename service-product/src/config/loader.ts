import * as fs from 'fs';
import * as path from 'path';
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
      port: z.coerce.number(),
    }),
    productService: z.object({
      port: z.coerce.number(),
    }),
  }),
  redis: z.object({
    host: z.string(),
    port: z.coerce.number(),
    password: z.string().optional(),
    db: z.coerce.number(),
    keyPrefix: z.string(),
    streams: z.object({
      maxLen: z.coerce.number(),
      blockMs: z.coerce.number(),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    pretty: z.boolean(),
  }),
  metrics: z.object({
    enabled: z.boolean(),
    collectDefaultMetrics: z.boolean().optional(),
    prefix: z.string().optional(),
    buckets: z.array(z.number()).optional(),
  }),
  security: z
    .object({
      encryptionEnabled: z.boolean(),
      keyRotationInterval: z.number(),
      auditLogging: z.boolean(),
      systemAuth: z
        .object({
          username: z.string().optional(),
          password: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  features: z
    .object({
      hotReload: z.boolean(),
      autoMigrate: z.boolean(),
      debugMode: z.boolean(),
      mockExternalServices: z.boolean().optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Enhanced configuration loader that:
 * 1. Loads base.json
 * 2. Loads {env}.json
 * 3. Merges them
 * 4. Applies environment variable overrides/substitutions
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

  private getConfigPath(): string {
    // Try to find config directory relative to CWD
    // We check multiple locations to handle different running contexts (root vs apps/xxx)
    const possiblePaths = [
      path.join(process.cwd(), 'src/config'),
      path.join(process.cwd(), 'config'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        return p;
      }
    }

    // Fallback - should ideally not happen in correct project structure
    console.warn('⚠️ Could not find config directory, using default hardcoded values');
    return '';
  }

  private loadJsonFile(filePath: string): any {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Failed to load config file: ${filePath}`, error);
        return {};
      }
    }
    return {};
  }

  private deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return target;

    const output = { ...target };

    for (const key of Object.keys(source)) {
      if (Array.isArray(source[key])) {
        // Arrays are replaced, not merged, to allow complete override of lists (e.g. brokers, buckets)
        output[key] = source[key];
      } else if (typeof source[key] === 'object' && source[key] !== null) {
        output[key] = key in target ? this.deepMerge(target[key], source[key]) : source[key];
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  private substituteEnvVars(config: any): any {
    if (typeof config === 'string') {
      // Replace ${VAR_NAME} with process.env.VAR_NAME
      if (config.startsWith('${') && config.endsWith('}')) {
        const varName = config.slice(2, -1);
        // Special handling for some vars if they are empty strings in env
        const val = process.env[varName];
        return val !== undefined ? val : config;
      }
      return config;
    }
    if (Array.isArray(config)) {
      return config.map(item => this.substituteEnvVars(item));
    }
    if (typeof config === 'object' && config !== null) {
      const result: any = {};
      for (const key in config) {
        result[key] = this.substituteEnvVars(config[key]);
      }
      return result;
    }
    return config;
  }

  private loadConfig(): Config {
    const configDir = this.getConfigPath();

    let config: any = {};

    if (configDir) {
      // 1. Load base config
      const baseConfig = this.loadJsonFile(path.join(configDir, 'base.json'));

      // 2. Load environment config
      const envConfig = this.loadJsonFile(path.join(configDir, `${this.env}.json`));

      // 3. Merge configs
      config = this.deepMerge(baseConfig, envConfig);
    } else {
      // Fallback defaults if config dir not found (legacy behavior)
      config = {
        app: { name: 'bun-hono-redis-cqrs', version: '1.0.0' },
        database: {
          url: 'postgres://postgres:postgres@localhost:5432/cqrs_demo?schema=public',
          pool: { min: 2, max: 10, idleTimeoutMs: 30000 },
        },
        auth: { jwt: { secret: 'default', expiresIn: '1d' } },
        services: {
          userService: { port: 3101 },
          productService: { port: 3102 },
        },
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0,
          keyPrefix: 'product:',
          streams: { maxLen: 10000, blockMs: 5000 },
        },
        logging: { level: 'info', pretty: true },
        metrics: { enabled: false },
        security: {
          encryptionEnabled: true,
          keyRotationInterval: 604800000,
          auditLogging: true,
          systemAuth: {
            username: 'system',
            password: 'system-password',
          },
        },
        features: {
          hotReload: false,
          autoMigrate: false,
          debugMode: false,
          mockExternalServices: false,
        },
      };
    }

    // 4. Apply environment variable overrides (Runtime/Secrets)
    // We apply these ON TOP of the loaded config to ensure env vars take precedence

    // Database overrides
    if (process.env.DB_URL) {
      if (!config.database) config.database = {};
      config.database.url = process.env.DB_URL;
    }

    // Service Ports
    if (process.env.USER_SERVICE_PORT) {
      if (!config.services) config.services = {};
      if (!config.services.userService) config.services.userService = {};
      config.services.userService.port = parseInt(process.env.USER_SERVICE_PORT);
    }
    if (process.env.PRODUCT_SERVICE_PORT) {
      if (!config.services) config.services = {};
      if (!config.services.productService) config.services.productService = {};
      config.services.productService.port = parseInt(process.env.PRODUCT_SERVICE_PORT);
    }

    // JWT Secret (Critical security override)
    if (process.env.JWT_SECRET) {
      if (!config.auth) config.auth = {};
      if (!config.auth.jwt) config.auth.jwt = {};
      config.auth.jwt.secret = process.env.JWT_SECRET;
    }

    // Redis overrides
    if (process.env.REDIS_HOST) {
      if (!config.redis) config.redis = {};
      config.redis.host = process.env.REDIS_HOST;
    }
    if (process.env.REDIS_PORT) {
      if (!config.redis) config.redis = {};
      config.redis.port = parseInt(process.env.REDIS_PORT);
    }
    if (process.env.REDIS_PASSWORD !== undefined) {
      if (!config.redis) config.redis = {};
      config.redis.password = process.env.REDIS_PASSWORD;
    }
    if (process.env.REDIS_DB) {
      if (!config.redis) config.redis = {};
      config.redis.db = parseInt(process.env.REDIS_DB);
    }

    // System Auth overrides
    if (process.env.SYSTEM_USER || process.env.SYSTEM_PASS) {
      if (!config.security) config.security = {};
      if (!config.security.systemAuth) config.security.systemAuth = {};
      if (process.env.SYSTEM_USER) config.security.systemAuth.username = process.env.SYSTEM_USER;
      if (process.env.SYSTEM_PASS) config.security.systemAuth.password = process.env.SYSTEM_PASS;
    }

    // 5. Substitute any ${VAR} placeholders in the config (e.g. from JSON files)
    config = this.substituteEnvVars(config);

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

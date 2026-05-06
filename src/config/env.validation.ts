import * as Joi from 'joi';

const httpsOriginList = Joi.string()
  .custom((value, helpers) => {
    const origins = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (origins.length === 0) {
      return helpers.error('any.invalid', { message: 'CORS_ORIGINS must contain at least one origin' });
    }
    for (const origin of origins) {
      if (!origin.startsWith('https://')) {
        return helpers.error('any.invalid', { message: `CORS_ORIGINS entry "${origin}" must use https:// in production` });
      }
    }
    return value;
  })
  .messages({ 'any.invalid': '{{#message}}' });

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.alternatives().try(Joi.number(), Joi.string()).default(3000),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // Redis (optional but if any key is set, host must be present)
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // JWT — required, longer minimum in production
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(8).required(),
  }),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Encryption key — exactly 32 ASCII chars (256-bit key)
  ENCRYPTION_KEY: Joi.string().length(32).required(),

  // CORS — required in production, must be https:// in production, free-form in dev
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: httpsOriginList.required(),
    otherwise: Joi.string().required(),
  }),

  // API key only mode toggle
  API_KEYS_ONLY: Joi.boolean().default(false),

  // IDMeta defaults (optional)
  IDMETA_BASE_URL: Joi.string().uri().optional(),

  // Rate limit defaults (used by Task 6)
  RATE_LIMIT_TTL: Joi.alternatives().try(Joi.number(), Joi.string()).default(60),
  RATE_LIMIT_MAX: Joi.alternatives().try(Joi.number(), Joi.string()).default(100),
}).unknown(true);

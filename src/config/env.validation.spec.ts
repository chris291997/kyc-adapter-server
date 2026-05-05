import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const baseValid = {
    NODE_ENV: 'production',
    PORT: '3000',
    DB_HOST: 'db',
    DB_PORT: '5432',
    DB_USERNAME: 'u',
    DB_PASSWORD: 'p',
    DB_NAME: 'n',
    JWT_SECRET: 'a'.repeat(32),
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    ENCRYPTION_KEY: 'a'.repeat(32),
    CORS_ORIGINS: 'https://app.example.com',
  };

  it('accepts a fully-populated production env', () => {
    const { error } = envValidationSchema.validate(baseValid);
    expect(error).toBeUndefined();
  });

  it('rejects production without CORS_ORIGINS', () => {
    const { CORS_ORIGINS, ...env } = baseValid;
    const { error } = envValidationSchema.validate(env);
    expect(error?.message).toMatch(/CORS_ORIGINS/);
  });

  it('rejects production with http:// origins', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      CORS_ORIGINS: 'http://app.example.com',
    });
    expect(error?.message).toMatch(/https/);
  });

  it('allows http:// origins in development', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    expect(error).toBeUndefined();
  });

  it('rejects production with short JWT_SECRET', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      JWT_SECRET: 'short',
    });
    expect(error?.message).toMatch(/JWT_SECRET/);
  });

  it('rejects production with non-32-char ENCRYPTION_KEY', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      ENCRYPTION_KEY: 'too-short',
    });
    expect(error?.message).toMatch(/ENCRYPTION_KEY/);
  });
});

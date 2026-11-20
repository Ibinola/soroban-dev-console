import { validateEnvironment } from '../validate-env';

describe('Environment Variable Validation (#1232)', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3001',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'super-secret-jwt-key-12345',
    ENABLE_SWAGGER: 'true',
  };

  it('should successfully validate and parse a correct environment configuration', () => {
    const parsed = validateEnvironment(validEnv);
    expect(parsed.PORT).toBe(3001);
    expect(parsed.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(parsed.ENABLE_SWAGGER).toBe(true);
  });

  it('should throw an error and list all missing or invalid variables when config is malformed', () => {
    const invalidEnv = {
      NODE_ENV: 'invalid-env',
      PORT: '99999', // Out of range
      DATABASE_URL: 'not-a-url',
      JWT_SECRET: 'short', // Too short
    };

    expect(() => validateEnvironment(invalidEnv)).toThrow(
      'Environment variable validation failed.'
    );
  });
});
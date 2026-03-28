const KNOWN_WEAK_SECRETS = [
  'dev-secret-change-me-in-prod',
  'dev-secret',
  'development-secret',
  'test-secret',
  'secret',
  'secret-key',
  'your-256-bit-secret',
];

export interface JwtValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateJwtSecret(
  secret: string | undefined,
  environment: string = process.env.NODE_ENV || 'dev'
): JwtValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!secret || secret.trim().length === 0) {
    errors.push('JWT_SECRET environment variable is not set');
    return { valid: false, errors, warnings };
  }

  const byteLength = Buffer.byteLength(secret, 'utf8');
  if (byteLength < 32) {
    errors.push(`JWT_SECRET must be at least 32 bytes (256 bits). Current: ${byteLength} bytes`);
  }

  const normalizedSecret = secret.toLowerCase();
  if (KNOWN_WEAK_SECRETS.includes(normalizedSecret)) {
    errors.push('JWT_SECRET is a known weak/default secret');
  }

  const isProdOrStaging = environment === 'prod' || environment === 'staging';
  const valid = errors.length === 0;

  if (!isProdOrStaging && warnings.length === 0 && errors.length > 0) {
    warnings.push(...errors);
    errors.length = 0;
  }

  return { valid, errors, warnings };
}

export function assertJwtSecret(): void {
  const secret = process.env.JWT_SECRET;
  const environment = process.env.NODE_ENV || 'dev';
  const result = validateJwtSecret(secret, environment);

  if (result.warnings.length > 0) {
    console.warn('[JWT Validation]', result.warnings.join('; '));
  }

  if (result.errors.length > 0) {
    const errorMsg = `[JWT Validation Failed (${environment})] ${result.errors.join('; ')}`;

    if (environment === 'prod' || environment === 'staging') {
      throw new Error(errorMsg);
    } else {
      console.warn(errorMsg);
    }
  } else {
    console.log(`[JWT Validation Passed] Environment: ${environment}`);
  }
}

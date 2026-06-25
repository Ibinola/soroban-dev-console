export const REDACTION_PATTERNS = [
  {
    name: 'email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    name: 'phone',
    regex: /\+?\d[\d\s\-]{7,15}/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    name: 'private_key',
    regex: /S[A-Z2-7]{55}/g,
    replacement: '[REDACTED_SECRET]',
  },
  {
    name: 'jwt',
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: '[REDACTED_TOKEN]',
  },
  {
    name: 'ip',
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[REDACTED_IP]',
  },
  {
    name: 'long_hex_secret',
    regex: /\b[a-f0-9]{64,}\b/gi,
    replacement: '[REDACTED_SECRET]',
  },
  {
    name: 'stellar_secret',
    regex: /S[A-Z2-7]{55}/g,
    replacement: '[REDACTED_STELLAR_SECRET]',
  },
  {
    name: 'api_key',
    regex: /\b(?:api[_-]?key|api[_-]?token|access[_-]?token)[=:]["']?[A-Za-z0-9_\-]{16,}["']?/gi,
    replacement: '[REDACTED_API_KEY]',
  },
  {
    name: 'bearer_token',
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    name: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED_SSN]',
  },
  {
    name: 'credit_card',
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[REDACTED_CARD]',
  },
];

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
  {
    name: 'github_token',
    regex: /gh[psou]_[A-Za-z0-9]{36,}/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    name: 'npm_token',
    regex: /npm_[A-Za-z0-9]{36,}/g,
    replacement: '[REDACTED_NPM_TOKEN]',
  },
  {
    name: 'wallet_seed',
    regex: /\b[GS][A-Z2-7]{55}\b/g,
    replacement: '[REDACTED_WALLET_KEY]',
  },
  {
    name: 'auth_header',
    regex: /(Authorization|X-Api-Key|X-Auth-Token):\s*\S+/gi,
    replacement: '$1: [REDACTED]',
  },
  {
    name: 'slack_token',
    regex: /xox[baprs]-\d+-\d+-\d+-[a-f0-9]+/gi,
    replacement: '[REDACTED_SLACK_TOKEN]',
  },
  {
    name: 'discord_token',
    regex: /[MN][A-Za-z\d]{23,25}\.[A-Za-z\d]{6,7}\.[A-Za-z\d_-]{27,38}/g,
    replacement: '[REDACTED_DISCORD_TOKEN]',
  },
];

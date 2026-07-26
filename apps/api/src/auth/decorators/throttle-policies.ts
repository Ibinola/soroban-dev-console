/**
 * SECURITY-729: Rate limiting rules for abuse resistance.
 *
 * Rate limits are applied consistently across abuse-prone endpoints.
 * Tiers are defined by severity of impact if abused:
 *   - STRICT: Auth, creation, and mutation endpoints (low rate, short window)
 *   - MODERATE: Data submission endpoints (medium rate)
 *   - PERMISSIVE: Read-only and informational endpoints (higher rate)
 */

export const THROTTLE_POLICIES = {
  /** STRICT: Appeals are abuse-prone - limit to 5 per 5 minutes */
  APPEALS: {
    limit: 5,
    windowSeconds: 300,
    tier: "strict" as const,
    description: "Appeal submissions",
  },

  /** MODERATE: Support tickets - 10 per 5 minutes */
  SUPPORT: {
    limit: 10,
    windowSeconds: 300,
    tier: "moderate" as const,
    description: "Support ticket creation",
  },

  /** PERMISSIVE: Verification checks - 20 per minute */
  VERIFICATION: {
    limit: 20,
    windowSeconds: 60,
    tier: "permissive" as const,
    description: "Verification status checks",
  },

  /** STRICT: Budget mutations - 3 per 5 minutes */
  BUDGET_ACTIONS: {
    limit: 3,
    windowSeconds: 300,
    tier: "strict" as const,
    description: "Budget modification actions",
  },

  /** STRICT: Owner key operations - 5 per minute */
  OWNER_KEY_OPS: {
    limit: 5,
    windowSeconds: 60,
    tier: "strict" as const,
    description: "Owner key creation and rotation",
  },

  /** STRICT: PII export operations - 2 per 10 minutes */
  PII_EXPORT: {
    limit: 2,
    windowSeconds: 600,
    tier: "strict" as const,
    description: "Personal data export requests",
  },

  /** STRICT: Webhook management - 10 per minute */
  WEBHOOK_OPS: {
    limit: 10,
    windowSeconds: 60,
    tier: "strict" as const,
    description: "Webhook configuration changes",
  },

  /** MODERATE: Workspace creation - 10 per 10 minutes */
  WORKSPACE_CREATE: {
    limit: 10,
    windowSeconds: 600,
    tier: "moderate" as const,
    description: "New workspace creation",
  },

  /** PERMISSIVE: Read queries - 100 per minute */
  READ_QUERIES: {
    limit: 100,
    windowSeconds: 60,
    tier: "permissive" as const,
    description: "General read operations",
  },
};

export type ThrottlePolicyName = keyof typeof THROTTLE_POLICIES;

export interface ThrottlePolicy {
  limit: number;
  windowSeconds: number;
  tier: "strict" | "moderate" | "permissive";
  description: string;
}


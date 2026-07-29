import { SetMetadata } from "@nestjs/common";
import { THROTTLE_POLICIES } from "./throttle-policies.js";

export const THROTTLE_POLICY_KEY = "throttle-policy";

export const ThrottlePolicy = (policy: keyof typeof THROTTLE_POLICIES) =>
  SetMetadata(THROTTLE_POLICY_KEY, policy);

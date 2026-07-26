import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { THROTTLE_POLICIES, type ThrottlePolicyName } from "../decorators/throttle-policies.js";

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  consume(identifier: string, policyName: ThrottlePolicyName): boolean {
    const policy = THROTTLE_POLICIES[policyName];
    const now = Date.now();
    const key = `ratelimit:${policyName}:${identifier}`;
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + policy.windowSeconds * 1000 });
      return true;
    }

    if (bucket.count >= policy.limit) {
      throw new HttpException(
        `Rate limit exceeded for ${policyName.toLowerCase()} operations`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }
}

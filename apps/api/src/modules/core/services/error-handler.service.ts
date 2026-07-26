import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
  type ErrorCode,
} from '@qyou/shared';
import * as crypto from 'crypto';

export class ErrorHandlerService {
  public formatError(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>
  ): ApiErrorResponse {
    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        requestId: crypto.randomUUID(),
        timestampIso: new Date().toISOString(),
      },
    };

    return apiErrorResponseSchema.parse(payload);
  }
}

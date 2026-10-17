import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiErrorResponse } from "@devconsole/api-contracts";
import { buildStructuredLogEntry, getCorrelationId } from "./request-context.js";

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let code = "INTERNAL_SERVER_ERROR";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      
      code = this.mapStatusToCode(status);
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        message = (res as any).message || message;
        code = (res as any).code || this.mapStatusToCode(status);
        details = (res as any).details || (res as any).errors;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // You might want to map specific Error types to codes here
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    console.error(
      JSON.stringify(
        buildStructuredLogEntry({
          level: "error",
          correlationId: getCorrelationId(),
          message: "api.error",
          method: request.method,
          path: request.url,
          statusCode: status,
          error: message,
        }),
      ),
    );

    response.status(status).json(errorResponse);
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "VALIDATION_ERROR";
      case HttpStatus.METHOD_NOT_ALLOWED:
        return "METHOD_NOT_ALLOWED";
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return "PAYLOAD_TOO_LARGE";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "TOO_MANY_REQUESTS";
      case HttpStatus.BAD_GATEWAY:
        return "BAD_GATEWAY";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "SERVICE_UNAVAILABLE";
      case HttpStatus.GATEWAY_TIMEOUT:
        return "GATEWAY_TIMEOUT";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }
}

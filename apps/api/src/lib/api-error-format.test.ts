import assert from "node:assert/strict";
import test from "node:test";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ApiErrorFilter } from "./api-error.filter.js";

interface Captured {
  status: number;
  body: any;
}

function run(exception: unknown, url = "/api/things?x=1"): Captured {
  const captured: Captured = { status: 0, body: undefined };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, method: "GET" }),
    }),
  };
  const original = console.error;
  console.error = () => {};
  try {
    new ApiErrorFilter().catch(exception, host as never);
  } finally {
    console.error = original;
  }
  return captured;
}

const cases: [string, unknown, number, string][] = [
  ["BadRequestException", new BadRequestException("bad"), 400, "BAD_REQUEST"],
  ["UnauthorizedException", new UnauthorizedException(), 401, "UNAUTHORIZED"],
  ["ForbiddenException", new ForbiddenException(), 403, "FORBIDDEN"],
  ["NotFoundException", new NotFoundException("nope"), 404, "NOT_FOUND"],
  ["ConflictException", new ConflictException(), 409, "CONFLICT"],
  ["UnprocessableEntityException", new UnprocessableEntityException(), 422, "VALIDATION_ERROR"],
  ["PayloadTooLargeException", new PayloadTooLargeException(), 413, "PAYLOAD_TOO_LARGE"],
  ["BadGatewayException", new BadGatewayException(), 502, "BAD_GATEWAY"],
  ["ServiceUnavailableException", new ServiceUnavailableException(), 503, "SERVICE_UNAVAILABLE"],
  ["GatewayTimeoutException", new GatewayTimeoutException(), 504, "GATEWAY_TIMEOUT"],
  // A bare HttpException with a string body (used by the RPC rate limiter) must be mapped too.
  ["HttpException(429) with string body", new HttpException("Too many", HttpStatus.TOO_MANY_REQUESTS), 429, "TOO_MANY_REQUESTS"],
  ["plain Error", new Error("boom"), 500, "INTERNAL_SERVER_ERROR"],
  ["non-Error throw", "just a string", 500, "INTERNAL_SERVER_ERROR"],
];

for (const [name, exception, status, code] of cases) {
  test(`error envelope is consistent for ${name}`, () => {
    const { status: s, body } = run(exception);
    assert.equal(s, status);
    assert.equal(body.success, false);
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, "string");
    assert.ok(body.error.message.length > 0);
    assert.equal(body.error.path, "/api/things?x=1");
    assert.ok(!Number.isNaN(Date.parse(body.error.timestamp)), "timestamp is an ISO date");
    assert.deepEqual(Object.keys(body).sort(), ["error", "success"]);
  });
}

test("validation errors keep the field messages in the envelope", () => {
  const { body } = run(
    new BadRequestException({ message: ["name must be a string"], error: "Bad Request", statusCode: 400 }),
  );
  assert.equal(body.error.code, "BAD_REQUEST");
  assert.deepEqual(body.error.message, ["name must be a string"]);
});

test("an explicit error code on the exception wins over the status mapping", () => {
  const { body } = run(
    new BadRequestException({ message: "rpc down", code: "RPC_UNAVAILABLE", details: { network: "testnet" } }),
  );
  assert.equal(body.error.code, "RPC_UNAVAILABLE");
  assert.deepEqual(body.error.details, { network: "testnet" });
});

test("internal errors are always reported as 500 with the generic code", () => {
  for (const thrown of [new TypeError("x"), null, undefined, 42]) {
    const { status, body } = run(thrown);
    assert.equal(status, 500);
    assert.equal(body.error.code, "INTERNAL_SERVER_ERROR");
  }
});

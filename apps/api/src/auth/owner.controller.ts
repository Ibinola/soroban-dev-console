/**
 * Issue #756: Owner key management endpoints.
 *
 * POST /api/owner/rotate — rotate the owner key for all owned workspaces.
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { OwnerKeyRotationService } from "./owner-key-rotation.service.js";

import { ApiProperty } from "@nestjs/swagger";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
class RotateKeyDto {
  @ApiProperty({ example: "<32+ character owner key>" })
  @IsString()
  @MinLength(32, { message: "oldKey must be at least 32 characters" })
  oldKey!: string;

  @ApiProperty({ example: "<32+ character owner key>" })
  @IsString()
  @MinLength(32, { message: "newKey must be at least 32 characters" })
  newKey!: string;
}

@ApiTags("owner")
@Controller("owner")
export class OwnerController {
  constructor(private readonly rotationService: OwnerKeyRotationService) {}

  /**
   * POST /api/owner/rotate
   *
   * Atomically rotates the owner key across all workspaces.
   * Sets a 24-hour read-only grace period for the old key.
   * Rate limited to 1 rotation per hour per key.
   */
  @ApiOperation({ summary: "Rotate" })
  @Post("rotate")
  @HttpCode(HttpStatus.OK)
  rotate(@Body() dto: RotateKeyDto) {
    return this.rotationService.rotate(dto);
  }
}

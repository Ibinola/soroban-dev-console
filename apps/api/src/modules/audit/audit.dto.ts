import { IsOptional, IsString, IsInt, IsISO8601, Min, Max } from "class-validator";
import { Type } from "class-transformer";

import { ApiPropertyOptional } from "@nestjs/swagger";
export class ListAuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceId?: string;

  /** Base64-encoded composite cursor (createdAt + id) for cursor-based pagination. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Page size for cursor-based pagination (max 100). */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /** Page size for offset-based pagination (max 100). */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  /** Only return audit logs created at or after this ISO timestamp. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdAfter?: string;

  /** Only return audit logs created at or before this ISO timestamp. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdBefore?: string;

  /**
   * Issue #1128: Comma-separated CSV export columns.
   * Allowed: timestamp, event, user, ip, details. Unknown values are ignored.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  columns?: string;
}
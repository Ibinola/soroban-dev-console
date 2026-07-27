import { IsOptional, IsString, IsInt, IsISO8601, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ListAuditDto {
  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  /** Base64-encoded composite cursor (createdAt + id) for cursor-based pagination. */
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Page size for cursor-based pagination (max 100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /** Page size for offset-based pagination (max 100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  /** Only return audit logs created at or after this ISO timestamp. */
  @IsOptional()
  @IsISO8601()
  createdAfter?: string;

  /** Only return audit logs created at or before this ISO timestamp. */
  @IsOptional()
  @IsISO8601()
  createdBefore?: string;
}
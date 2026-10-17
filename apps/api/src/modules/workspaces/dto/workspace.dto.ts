/**
 * Issue #757: Input sanitization for workspace names and descriptions to prevent stored XSS.
 *
 * Custom validators strip/reject HTML tags from name, description, and share label fields.
 * Returns 400 if the sanitized value differs from the original (rather than silently stripping).
 */

import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  IsArray,
  ValidateNested,
  IsObject,
  IsInt,
  Min,
  Max,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  IsBoolean,
} from "class-validator";
import { Type, Transform } from "class-transformer";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
/** Regex to detect HTML tags (including script, style, event handlers) */
const HTML_TAG_PATTERN = /<[^>]*>/g;
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<[a-z][\s\S]*>/gi,
];

/**
 * Issue #757: Custom validator that rejects strings containing HTML tags.
 * Returns false (and triggers 400) if the value contains any HTML markup.
 */
function NoHtmlTags(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "noHtmlTags",
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must not contain HTML tags or script content`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== "string") return true; // let other validators handle type errors
          return !DANGEROUS_PATTERNS.some((p) => p.test(value)) && !HTML_TAG_PATTERN.test(value);
        },
      },
    });
  };
}

const NETWORKS = ["testnet", "mainnet", "futurenet", "local"] as const;

class WorkspaceContractDto {
  @ApiProperty({ example: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" })
  @IsString()
  contractId!: string;

  @ApiPropertyOptional({ example: "testnet" })
  @IsOptional()
  @IsString()
  network?: string;
}

class WorkspaceInteractionDto {
  @ApiProperty({ example: "transfer" })
  @IsString()
  functionName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  argumentsJson?: Record<string, unknown>;
}

class WorkspaceArtifactRefDto {
  @ApiProperty({ example: "contract" })
  @IsString()
  kind!: string;

  @ApiProperty({ example: "ws_123" })
  @IsString()
  id!: string;
}

export class CreateWorkspaceDto {
  @ApiProperty({ example: "My workspace" })
  @IsString()
  @MaxLength(120)
  @NoHtmlTags()
  name!: string;

  @ApiPropertyOptional({ example: "Contracts for the token project" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtmlTags()
  description?: string;

  @ApiPropertyOptional({ example: "testnet" })
  @IsOptional()
  @IsIn(NETWORKS)
  selectedNetwork?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceContractDto)
  contracts?: WorkspaceContractDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceInteractionDto)
  interactions?: WorkspaceInteractionDto[];
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: "My workspace" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @NoHtmlTags()
  name?: string;

  @ApiPropertyOptional({ example: "Contracts for the token project" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtmlTags()
  description?: string;

  @ApiPropertyOptional({ example: "testnet" })
  @IsOptional()
  @IsIn(NETWORKS)
  selectedNetwork?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  /**
   * BE-006: Optimistic concurrency control.
   * If provided, the update is rejected with 409 if the stored revision differs.
   */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  revision?: number;
}

export class ImportWorkspaceDto {
  /** Must be 2 — older versions are rejected to avoid silent data corruption */
  @ApiProperty()
  @IsInt()
  @Min(2)
  version!: number;

  @ApiProperty({ example: "ws_123" })
  @IsString()
  id!: string;

  @ApiProperty({ example: "My workspace" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  contractIds!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  savedCallIds!: string[];

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceArtifactRefDto)
  artifactRefs!: WorkspaceArtifactRefDto[];

  @ApiProperty({ example: "testnet" })
  @IsString()
  selectedNetwork!: string;
}

/** BE-005: Pagination and filtering for workspace list */
export class ListWorkspacesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["updatedAt", "createdAt", "name"])
  sortBy?: "updatedAt" | "createdAt" | "name";

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @ApiPropertyOptional({ example: "testnet" })
  @IsOptional()
  @IsString()
  network?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}

/** BE-005: Pagination response envelope */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    skip: number;
    take: number;
  };
}

export class SearchWorkspacesDto {
  @ApiProperty()
  @IsString()
  q!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["updatedAt", "createdAt", "name"])
  sortBy?: "updatedAt" | "createdAt" | "name";

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}

export class UpdateWorkspaceTagsDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Max(20)
  tags!: string[];
}

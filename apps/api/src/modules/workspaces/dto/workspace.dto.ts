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
} from "class-validator";
import { Type } from "class-transformer";

const NETWORKS = ["testnet", "mainnet", "futurenet", "local"] as const;

class WorkspaceContractDto {
  @IsString()
  contractId!: string;

  @IsOptional()
  @IsString()
  network?: string;
}

class WorkspaceInteractionDto {
  @IsString()
  functionName!: string;

  @IsOptional()
  @IsObject()
  argumentsJson?: Record<string, unknown>;
}

class WorkspaceArtifactRefDto {
  @IsString()
  kind!: string;

  @IsString()
  id!: string;
}

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(NETWORKS)
  selectedNetwork?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceContractDto)
  contracts?: WorkspaceContractDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceInteractionDto)
  interactions?: WorkspaceInteractionDto[];
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(NETWORKS)
  selectedNetwork?: string;

  /**
   * BE-006: Optimistic concurrency control.
   * If provided, the update is rejected with 409 if the stored revision differs.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  revision?: number;
}

export class ImportWorkspaceDto {
  /** Must be 2 — older versions are rejected to avoid silent data corruption */
  @IsInt()
  @Min(2)
  version!: number;

  @IsString()
  id!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  contractIds!: string[];

  @IsArray()
  @IsString({ each: true })
  savedCallIds!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceArtifactRefDto)
  artifactRefs!: WorkspaceArtifactRefDto[];

  @IsString()
  selectedNetwork!: string;
}

/** BE-005: Pagination and filtering for workspace list */
export class ListWorkspacesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @IsIn(["updatedAt", "createdAt", "name"])
  sortBy?: "updatedAt" | "createdAt" | "name";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @IsOptional()
  @IsString()
  network?: string;
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

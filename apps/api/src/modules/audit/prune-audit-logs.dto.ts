import { IsOptional, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

import { ApiPropertyOptional } from "@nestjs/swagger";
export class PruneAuditLogsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  olderThanDays?: number;
}

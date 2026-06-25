import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import {
  AiMonitorService,
  ListSnapshotsDto,
  RecordSnapshotDto,
} from "./ai-monitor.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("ai-monitor")
@UseGuards(OwnerKeyGuard)
export class AiMonitorController {
  constructor(private readonly service: AiMonitorService) {}

  @Post("snapshot")
  @HttpCode(HttpStatus.CREATED)
  snapshot(@Body() dto: RecordSnapshotDto, @Req() req: Request) {
    return this.service.snapshot(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get()
  list(@Query() query: ListSnapshotsDto) {
    return this.service.list(query);
  }

  @Get("alerts")
  listAlerts() {
    return this.service.listAlerts();
  }

  @Get("summary")
  summary() {
    return this.service.summary();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service.js";
import { CreateWorkspaceDto, UpdateWorkspaceDto } from "./workspace.dto.js";

@Controller("api/workspaces")
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkspaceDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.service.update(id, dto);
  }
}

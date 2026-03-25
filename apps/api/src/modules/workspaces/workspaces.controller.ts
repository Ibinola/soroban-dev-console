import { Controller, Get } from "@nestjs/common";

@Controller("workspaces")
export class WorkspacesController {
  @Get()
  listWorkspaces() {
    return [];
  }
}

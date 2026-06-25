import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { PromptPolicyService } from "./prompt-policy.service.js";
import type { CreatePromptPolicyPayload } from "@devconsole/api-contracts";

@Controller("prompt-policy")
export class PromptPolicyController {
  constructor(private readonly service: PromptPolicyService) {}

  /** Create a new version for a key. */
  @Post()
  create(@Body() body: CreatePromptPolicyPayload) {
    return this.service.create(body);
  }

  /** Get the currently active entry for a key. */
  @Get(":key/active")
  getActive(@Param("key") key: string) {
    return this.service.getActive(key);
  }

  /** Activate a specific version for a key. */
  @Post(":key/activate/:version")
  activate(
    @Param("key") key: string,
    @Param("version", ParseIntPipe) version: number,
    @Query("publishedBy") publishedBy?: string,
  ) {
    return this.service.activate(key, version, publishedBy);
  }

  /** List all versions for a key (latest first). */
  @Get(":key/versions")
  listByKey(@Param("key") key: string) {
    return this.service.listByKey(key);
  }

  /** List all entries filtered by kind. */
  @Get()
  listByKind(@Query("kind") kind = "prompt") {
    return this.service.listByKind(kind);
  }
}

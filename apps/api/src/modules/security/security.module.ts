import { Module } from "@nestjs/common";
import { RedactionService } from "./services/redaction.service.js";

/**
 * SecurityModule
 *
 * Encapsulates security-related services that can be imported by other modules.
 * Currently provides:
 *  - RedactionService: scrubs secrets from log metadata and audit entries
 */
@Module({
  providers: [RedactionService],
  exports: [RedactionService],
})
export class SecurityModule {}

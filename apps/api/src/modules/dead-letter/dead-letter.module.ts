import { Module } from "@nestjs/common";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { DeadLetterController } from "./dead-letter.controller.js";
import { DeadLetterService } from "./dead-letter.service.js";

@Module({
  controllers: [DeadLetterController],
  providers: [DeadLetterService, DomainEventBus],
  exports: [DeadLetterService],
})
export class DeadLetterModule {}

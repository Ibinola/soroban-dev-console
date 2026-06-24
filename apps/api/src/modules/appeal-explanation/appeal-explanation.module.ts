import { Module } from "@nestjs/common";
import { AppealExplanationController } from "./appeal-explanation.controller.js";
import { AppealExplanationService } from "./appeal-explanation.service.js";

@Module({
  controllers: [AppealExplanationController],
  providers: [AppealExplanationService],
  exports: [AppealExplanationService],
})
export class AppealExplanationModule {}

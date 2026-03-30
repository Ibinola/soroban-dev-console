import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module.js";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module.js";
import { RpcModule } from "./modules/rpc/rpc.module.js";
import { CorrelationMiddleware } from "./common/logging/correlation.middleware.js";
import { RpcLoggingMiddleware } from "./common/logging/rpc-logging.middleware.js";

@Module({
  imports: [HealthModule, WorkspacesModule, RpcModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationMiddleware, RpcLoggingMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}

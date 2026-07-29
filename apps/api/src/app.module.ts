import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthModule } from "./modules/health/health.module.js";
import { RpcModule } from "./modules/rpc/rpc.module.js";
import { RuntimeConfigModule } from "./modules/runtime-config/runtime-config.module.js";
import { FixtureManifestModule } from "./modules/fixture-manifest/fixture-manifest.module.js";
import { SharesModule } from "./modules/shares/shares.module.js";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module.js";
import { DeadLetterModule } from "./modules/dead-letter/dead-letter.module.js";
import { BackgroundJobModule } from "./modules/jobs/background-job.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env"
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    RpcModule,
    RuntimeConfigModule,
    FixtureManifestModule,
    SharesModule,
    WorkspacesModule,
    DeadLetterModule,
    BackgroundJobModule,
    AuditModule,
  ]
})
export class AppModule { }

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module.js";
import { RpcModule } from "./modules/rpc/rpc.module.js";
import { RuntimeConfigModule } from "./modules/runtime-config/runtime-config.module.js";
import { FixtureManifestModule } from "./modules/fixture-manifest/fixture-manifest.module.js";
import { SharesModule } from "./modules/shares/shares.module.js";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module.js";
import { BackgroundJobModule } from "./modules/jobs/background-job.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env"
    }),
    HealthModule,
    RpcModule,
    RuntimeConfigModule,
    FixtureManifestModule,
    SharesModule,
    WorkspacesModule,
    BackgroundJobModule,
    AuditModule,
  ]
})
export class AppModule { }

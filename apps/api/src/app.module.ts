import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module.js";
import { RpcModule } from "./modules/rpc/rpc.module.js";
import { RuntimeConfigModule } from "./modules/runtime-config/runtime-config.module.js";
import { FixtureManifestModule } from "./modules/fixture-manifest/fixture-manifest.module.js";
import { SharesModule } from "./modules/shares/shares.module.js";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module.js";
import { ContributorVerificationModule } from "./modules/contributor-verification/contributor-verification.module.js";
import { AppealDecisionsModule } from "./modules/appeal-decisions/appeal-decisions.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { PointLedgerModule } from "./modules/point-ledger/point-ledger.module.js";
import { VerificationModule } from "./modules/verification/verification.module.js";
import { ReviewContextModule } from "./modules/review-context/review-context.module.js";
import { BackgroundJobModule } from "./modules/jobs/background-job.module.js";
import { WaveModule } from "./modules/wave/wave.module.js";

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
    ContributorVerificationModule,
    AppealDecisionsModule,
    NotificationsModule,
    PointLedgerModule,
    VerificationModule,
    ReviewContextModule,
    BackgroundJobModule,
    WaveModule,
  ]
})
export class AppModule {}

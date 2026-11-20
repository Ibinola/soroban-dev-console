import { ConnectWalletButton } from "@/components/wallet-connect";
import { Button } from "@devconsole/ui";
import { TransactionFeed } from "@/components/transaction-feed";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@devconsole/ui";
import { Wallet, ArrowRight, BookOpen, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { WORKSPACE_TEMPLATES } from "@/lib/fixture-manifest";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";

import { getTranslations } from "@/i18n/server";
export default async function Home() {
  const t = await getTranslations();
  return (
    <main className="min-h-screen bg-background">
      {/* Top Hero / Welcome Section */}
      <div className="border-b bg-muted/40">
        <div className="container mx-auto p-6 py-10">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight">
              {t("common.appName")}
            </h1>
            <p className="max-w-2xl text-xl text-muted-foreground">
              {t("home.tagline")}
            </p>
            <div className="flex gap-3 pt-4">
              <div className="md:hidden">
                <ConnectWalletButton />
              </div>
              <Button variant="outline" className="gap-2" asChild>
                {/* docs route was removed in the strip commit; link to the quickstart doc */}
                <a
                  href="https://developers.stellar.org/docs/smart-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BookOpen className="h-4 w-4" />
                  {t("home.documentation")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="container mx-auto grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                {t("home.account.title")}
              </CardTitle>
              <CardDescription>
                {t("home.account.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-[150px] items-center justify-center border-t bg-muted/10">
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("home.account.noWallet")}
                </p>
                <ConnectWalletButton />
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link href="/contracts" className="block">
              <Card className="group cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {t("home.links.contractExplorer.title")}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription>
                    {t("home.links.contractExplorer.description")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/tools/xdr" className="block">
              <Card className="group cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {t("home.links.xdrDecoder.title")}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription>{t("home.links.xdrDecoder.description")}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>

          {/* FE-032: Workspace template starter packs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                {t("home.templates.title")}
              </CardTitle>
              <CardDescription>
                {t("home.templates.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
              {WORKSPACE_TEMPLATES.map((template) => (
                <WorkspaceTemplateCard key={template.key} template={template} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="h-full min-h-[500px] lg:col-span-1">
          <TransactionFeed />
        </div>
      </div>
    </main>
  );
}

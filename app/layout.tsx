import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
    title: "Soroban DevConsole",
    description: "Developer toolkit for Soroban smart contracts",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset>
                        <SiteHeader />
                        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                            {children}
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </body>
        </html>
    );
}
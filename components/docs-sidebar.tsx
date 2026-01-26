
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Book, Rocket, Code, Layers, Settings, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const docsRoutes = [
  {
    title: "Introduction",
    items: [
      { title: "Introduction", href: "/docs", icon: Book },
      { title: "Getting Started", href: "/docs/getting-started", icon: Rocket },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Contract Explorer", href: "/docs/explorer", icon: Layers },
      { title: "Interacting", href: "/docs/interacting", icon: Code },
      { title: "Adding a Contract", href: "/docs/deploying", icon: Settings },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-full pb-6">
      {docsRoutes.map((group, i) => (
        <div key={i} className="mb-6">
          <h4 className="mb-2 px-2 text-sm font-semibold tracking-tight text-muted-foreground">
            {group.title}
          </h4>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Button
                key={item.href}
                variant={pathname === item.href ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-2 font-normal",
                  pathname === item.href && "bg-muted font-medium",
                )}
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

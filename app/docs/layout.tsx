import { DocsSidebar } from "@/components/docs-sidebar"; 
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 p-6">
      <aside className="fixed top-24 z-30 -ml-2 hidden h-[calc(100vh-6rem)] w-full shrink-0 md:sticky md:block">
        <ScrollArea className="h-full py-2 pr-6">
          <DocsSidebar />
        </ScrollArea>
      </aside>
      <main className="relative py-2 lg:gap-10 xl:grid xl:grid-cols-[1fr_200px]">
        <div className="mx-auto w-full min-w-0">{children}</div>
      </main>
    </div>
  );
}

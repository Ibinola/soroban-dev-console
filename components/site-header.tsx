import { ConnectWalletButton } from "@/components/wallet-connect"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ChevronDown, Menu } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10 bg-background">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
      <div className="flex flex-1 items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium">Dashboard</span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {/* Desktop View */}
          <div className="hidden md:flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Testnet <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Testnet</DropdownMenuItem>
                <DropdownMenuItem>Mainnet</DropdownMenuItem>
                <DropdownMenuItem>Futurenet</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConnectWalletButton />
          </div>

          {/* Mobile View */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="px-6">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8 px-2">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Network</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-between w-full">
                        Testnet <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      <DropdownMenuItem>Testnet</DropdownMenuItem>
                      <DropdownMenuItem>Mainnet</DropdownMenuItem>
                      <DropdownMenuItem>Futurenet</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <ConnectWalletButton />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

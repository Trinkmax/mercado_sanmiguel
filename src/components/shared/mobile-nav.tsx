"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/shared/nav-links";
import { Marca } from "@/components/shared/marca";
import type { Rol } from "@/lib/auth";

/** Menú de navegación para tablet/celular: cajón lateral con targets grandes. */
export function MobileNav({
  rol,
  nombre,
  rolLabel,
  logout,
}: {
  rol: Rol;
  nombre: string;
  rolLabel: string;
  logout: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Abrir menú"
        >
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-sidebar-border p-4">
          <SheetTitle asChild>
            <Marca compacta className="text-sidebar-foreground" />
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks rol={rol} onNavigate={() => setAbierto(false)} />
        </div>
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="text-sm">
            <p className="font-medium">{nombre}</p>
            <p className="text-sidebar-foreground/70">{rolLabel}</p>
          </div>
          {logout}
        </div>
      </SheetContent>
    </Sheet>
  );
}

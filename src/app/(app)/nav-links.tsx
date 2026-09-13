"use client";

import {
  HouseIcon,
  LayersIcon,
  LibraryBigIcon,
  ListChecksIcon,
  ScanLineIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/catalog", label: "Catálogo" },
  { href: "/inventory", label: "Mis cartas" },
  { href: "/collections", label: "Colecciones" },
  { href: "/decks", label: "Mazos" },
  { href: "/locations", label: "Ubicaciones" },
  { href: "/scan", label: "Escanear" },
  { href: "/search", label: "Buscar" },
];

// Phones: five tabs at the bottom, the scanner in the middle. Search lives in the top bar;
// locations are reached from "Mis cartas".
const TABS: Array<{ href: string; label: string; icon: LucideIcon; primary?: boolean; also?: string[] }> = [
  { href: "/", label: "Resumen", icon: HouseIcon },
  { href: "/catalog", label: "Catálogo", icon: LibraryBigIcon },
  { href: "/scan", label: "Escanear", icon: ScanLineIcon, primary: true },
  { href: "/inventory", label: "Mis cartas", icon: LayersIcon, also: ["/locations"] },
  // Decks are reached from here too (the switcher at the top of both pages).
  { href: "/collections", label: "Colecciones", icon: ListChecksIcon, also: ["/decks"] },
];

const isActive = (pathname: string, href: string, also: string[] = []) =>
  href === "/" ? pathname === "/" : [href, ...also].some((h) => pathname.startsWith(h));

/** Text links in the top bar, from tablet width up. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Principal">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1.5 transition-colors",
            isActive(pathname, href)
              ? "bg-primary/12 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar on phones. The full-screen scanner (z-50) covers it while scanning. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, primary, also }) => {
          const active = isActive(pathname, href, also);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                  active ? "text-primary font-medium" : "text-muted-foreground",
                )}
              >
                {primary ? (
                  <span
                    className={cn(
                      "bg-primary text-primary-foreground -mt-6 flex size-12 items-center justify-center rounded-full shadow-md ring-4 ring-background",
                      active && "ring-primary/25",
                    )}
                  >
                    <Icon className="size-6" />
                  </span>
                ) : (
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

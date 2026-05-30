import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronRight, Command, Search } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const ROUTES: { path: string; label: string; group: string }[] = [
  { path: "/", label: "Dashboard", group: "Pages" },
  { path: "/cloud", label: "Cloud usage", group: "Pages" },
  { path: "/optimization", label: "Optimization", group: "Pages" },
  { path: "/anomalies", label: "Anomalies", group: "Pages" },
  { path: "/chargeback", label: "Chargeback", group: "Pages" },
  { path: "/workforce", label: "Workforce", group: "Pages" },
  { path: "/resources", label: "Resources", group: "Pages" },
  { path: "/govern/exchange", label: "Data exchange", group: "Governance" },
  { path: "/govern/partners", label: "Partners", group: "Governance" },
  { path: "/govern/alignment", label: "Alignment", group: "Governance" },
  { path: "/assistant", label: "AI assistant", group: "Tools" },
  { path: "/plugins", label: "Plugins", group: "Tools" },
  { path: "/settings", label: "Settings", group: "Tools" },
];

function crumbsFor(pathname: string): string[] {
  if (pathname === "/") return ["Dashboard"];
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((p) => p.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));
}

export function Topbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pendingApprovals = useStore((s) => s.dataRequests.filter((r) => r.status === "pending").length);
  const openAnomalies = useStore((s) => s.anomalies.filter((a) => a.status !== "resolved").length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = crumbsFor(pathname);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="h-full flex items-center gap-4 px-4 sm:px-6">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              <span className={i === crumbs.length - 1 ? "text-foreground font-medium truncate" : "truncate"}>
                {c}
              </span>
            </span>
          ))}
        </nav>

        <div className="flex-1" />

        <button
          onClick={() => setOpen(true)}
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-md bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors text-sm w-72"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search anything…</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-background/60">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => navigate({ to: "/anomalies" })}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {(pendingApprovals + openAnomalies) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {pendingApprovals + openAnomalies}
            </span>
          )}
        </Button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a page or action…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {ROUTES.filter((r) => r.group === "Pages").map((r) => (
              <CommandItem key={r.path} onSelect={() => { setOpen(false); navigate({ to: r.path }); }}>
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Governance">
            {ROUTES.filter((r) => r.group === "Governance").map((r) => (
              <CommandItem key={r.path} onSelect={() => { setOpen(false); navigate({ to: r.path }); }}>
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Tools">
            {ROUTES.filter((r) => r.group === "Tools").map((r) => (
              <CommandItem key={r.path} onSelect={() => { setOpen(false); navigate({ to: r.path }); }}>
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, ArrowLeftRight, Boxes, Building2, Cpu,
  LayoutDashboard, MessageSquare, Plug, Receipt, Settings, Sparkles, Users, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Cloud & cost",
    items: [
      { to: "/cloud", label: "Cloud usage", icon: Cpu },
      { to: "/optimization", label: "Optimization", icon: Wand2 },
      { to: "/anomalies", label: "Anomalies", icon: AlertTriangle },
    ],
  },
  {
    label: "Organization",
    items: [
      { to: "/chargeback", label: "Chargeback", icon: Receipt },
      { to: "/workforce", label: "Workforce", icon: Users },
      { to: "/resources", label: "Resources", icon: Boxes },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/govern/exchange", label: "Data exchange", icon: ArrowLeftRight },
      { to: "/govern/partners", label: "Partners", icon: Building2 },
      { to: "/govern/discussions", label: "Discussions", icon: MessageSquare },
      { to: "/govern/alignment", label: "Alignment", icon: Activity },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/assistant", label: "AI assistant", icon: Sparkles },
      { to: "/plugins", label: "Plugins", icon: Plug },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border/60">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-display font-bold">
          F
        </div>
        <div className="leading-tight">
          <div className="font-display font-bold tracking-tight">Flex</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cloud FinOps</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                    )}
                  >
                    <it.icon className="h-4 w-4" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2.5 rounded-md p-2 hover:bg-sidebar-accent/60 transition-colors">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary font-display text-xs font-semibold">
            SC
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <div className="text-sm font-medium truncate">S. Chen</div>
            <div className="text-[11px] text-muted-foreground truncate">FinOps Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

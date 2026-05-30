import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/Primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/govern")({
  head: () => ({
    meta: [
      { title: "Governance — Flex" },
      { name: "description", content: "Governed data exchange with partner apps, plus alignment." },
    ],
  }),
  component: Govern,
});

const TABS = [
  { to: "/govern/exchange", label: "Data exchange" },
  { to: "/govern/partners", label: "Partners" },
  { to: "/govern/discussions", label: "Discussions" },
  { to: "/govern/alignment", label: "Alignment" },
] as const;

function Govern() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Governance"
        title="Governed data exchange"
        description="Approve dataset requests, manage partner integrations and track initiative alignment."
      />
      <div className="mt-6 border-b border-border/60 flex gap-1">
        {TABS.map((t) => {
          const active = pathname === t.to || (pathname === "/govern" && t.to === "/govern/exchange");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}

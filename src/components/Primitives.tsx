import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, eyebrow, actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-border/60">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label, value, sub, tone = "default", icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    default: "text-muted-foreground",
    good: "text-success",
    warn: "text-warning",
    bad: "text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-elev hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4 text-primary/70" />}
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className={cn("mt-1.5 text-xs font-medium", toneClass)}>{sub}</div>}
    </div>
  );
}

export function SectionCard({
  title, description, actions, children, className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card shadow-elev", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border/60">
          <div>
            {title && <h2 className="font-display text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SeverityDot({ severity }: { severity: "critical" | "high" | "medium" | "low" }) {
  const c = {
    critical: "bg-destructive",
    high: "bg-warning",
    medium: "bg-primary",
    low: "bg-muted-foreground",
  }[severity];
  return <span className={cn("inline-block h-2 w-2 rounded-full", c)} />;
}

export function formatUSD(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && Math.abs(n) >= 1000) {
    return "$" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function timeAgo(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

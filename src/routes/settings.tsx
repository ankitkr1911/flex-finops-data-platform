import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Flex" },
      { name: "description", content: "Profile, role, and governance settings." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [meetingMode, setMeetingMode] = useState(false);
  const [hibp, setHibp] = useState(true);
  const [demoMode, setDemoMode] = useState(true);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-3xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Tools"
        title="Settings"
        description="Profile, role, and platform-wide preferences."
      />

      <SectionCard title="Profile">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="S. Chen" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="s.chen@flex.io" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select defaultValue="finance-admin">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="finance-admin">Finance Admin</SelectItem>
                <SelectItem value="platform">Platform Engineer</SelectItem>
                <SelectItem value="admin">Workspace Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cost center</Label>
            <Input defaultValue="CC-4100" />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={() => toast.success("Profile saved")}>Save profile</Button>
        </div>
      </SectionCard>

      <SectionCard title="Preferences">
        <div className="space-y-4">
          <PrefRow
            label="Meeting mode"
            desc="Hide noisy data and emphasize KPIs in screen-shares."
            checked={meetingMode}
            onChange={setMeetingMode}
          />
          <PrefRow
            label="Demo mode"
            desc="Show seeded sample data so the platform is always presentable."
            checked={demoMode}
            onChange={setDemoMode}
          />
          <PrefRow
            label="Leaked password check (HIBP)"
            desc="Reject sign-ups using passwords known to be breached."
            checked={hibp}
            onChange={setHibp}
          />
        </div>
      </SectionCard>

      <SectionCard title="Governance" description="Compliance & audit">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-success/15 text-success">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">Proof-of-governance bundle</div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Export a signed JSON + markdown audit pack with approvals, field boundaries and undo events for the last 90 days.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => toast.success("Audit bundle exported")}>
            <Download className="h-4 w-4" />Export
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function PrefRow({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

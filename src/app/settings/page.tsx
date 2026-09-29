import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardCanvas,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Users, Settings2, Upload, ShieldCheck, Save, Link2, Pill } from "lucide-react";

export const metadata: Metadata = {
  title: "Settings",
};

const staff = [
  { name: "Rajesh Kumar", email: "owner@maharashtrapharma.in", role: "Admin", variant: "default" as const, status: "Active" },
  { name: "Neha", email: "neha@maharashtrapharma.in", role: "Inventory", variant: "badge-violet" as const, status: "Active" },
  { name: "Sameer", email: "sameer@maharashtrapharma.in", role: "Billing", variant: "badge-emerald" as const, status: "Invited" },
  { name: "Priya", email: "priya@maharashtrapharma.in", role: "Manager", variant: "badge-orange" as const, status: "Active" },
];

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Settings</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Business profile, team members and workspace configuration.
          </p>
        </div>
        <Button>
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </CardHeader>

      <Tabs defaultValue="business">
        <TabsList className="mb-5">
          <TabsTrigger value="business">
            <Building2 className="h-4 w-4 mr-2" /> Business
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" /> Team
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Pill className="h-4 w-4 mr-2" /> Tax &amp; format
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Link2 className="h-4 w-4 mr-2" /> Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-0 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CardCanvas>
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md">
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted" />
                    Business profile
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Business name (as per GST)</Label>
                  <Input defaultValue="Maharashtra Pharma Distributors" />
                </div>
                <div className="space-y-2">
                  <Label>Trade name</Label>
                  <Input defaultValue="MPD Pharma" />
                </div>
                <div className="space-y-2">
                  <Label>Owner / proprietor</Label>
                  <Input defaultValue="Rajesh Kumar" />
                </div>
                <div className="space-y-2">
                  <Label>Primary phone</Label>
                  <Input defaultValue="+91 98 8888 0012" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue="accounts@maharashtrapharma.in" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Registered address</Label>
                  <Input defaultValue="Shop 12, Central Market, Pune, Maharashtra 411001" />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select defaultValue="mh">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mh">Maharashtra</SelectItem>
                      <SelectItem value="gj">Gujarat</SelectItem>
                      <SelectItem value="ka">Karnataka</SelectItem>
                      <SelectItem value="dl">Delhi</SelectItem>
                      <SelectItem value="tn">Tamil Nadu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>PIN code</Label>
                  <Input defaultValue="411001" />
                </div>
              </CardContent>
            </CardCanvas>

            <CardCanvas>
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md">Licences</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input defaultValue="27AACXX0000B1ZP" />
                </div>
                <div className="space-y-2">
                  <Label>Pharmacy licence no.</Label>
                  <Input defaultValue="MH/2008/PH-001234" />
                </div>
                <div className="space-y-2">
                  <Label>Drug licence (Form 20/21)</Label>
                  <Input defaultValue="MH/D/LC/2018/00987" />
                </div>
                <div className="space-y-2">
                  <Label>FSSAI (if stocked)</Label>
                  <Input defaultValue="10820000000000" />
                </div>
              </CardContent>
            </CardCanvas>
          </div>

          <div className="space-y-6">
            <CardCanvas>
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md">Workspace ID</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-body-sm text-body">
                  <code className="rounded-md bg-surface-card px-2 py-1 text-sm text-ink">
                    tenant_mh_mpd_00001
                  </code>
                </p>
                <p className="text-caption text-muted">
                  Share this code with support for quick troubleshooting.
                </p>
              </CardContent>
            </CardCanvas>

            <CardCanvas>
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md">Logo &amp; branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-dashed border-hairline p-6 text-center">
                  <Upload className="h-8 w-8 text-muted mx-auto" />
                  <p className="mt-2 text-nav-link font-semibold text-ink">Upload logo</p>
                  <p className="text-caption text-muted">PNG · 256x256 · &lt; 500kb</p>
                  <Button variant="secondary" size="sm" className="mt-3">Choose file</Button>
                </div>
              </CardContent>
            </CardCanvas>

            <CardCanvas>
              <CardHeader className="pb-3">
                <CardTitle className="text-title-md">Danger zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="destructive" size="sm" className="w-full">
                  Close workspace
                </Button>
              </CardContent>
            </CardCanvas>
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-0">
          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-title-md">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted" />
                  Team &amp; roles
                </span>
              </CardTitle>
              <Button size="sm">
                <ShieldCheck className="h-4 w-4" /> Invite member
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((m) => (
                    <TableRow key={m.email}>
                      <TableCell className="font-medium text-ink">{m.name}</TableCell>
                      <TableCell className="text-body">{m.email}</TableCell>
                      <TableCell>
                        <Badge variant={m.variant}>{m.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "Active" ? "success" : "secondary"}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href="#">Manage</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>
        </TabsContent>

        <TabsContent value="tax" className="mt-0">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted" />
                  Taxation &amp; invoice format
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default GST treatment</Label>
                <Select defaultValue="intra">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intra">Intra-state (CGST+SGST)</SelectItem>
                    <SelectItem value="inter">Inter-state (IGST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rounding on totals</Label>
                <Select defaultValue="nearest">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nearest">Round to nearest rupee</SelectItem>
                    <SelectItem value="down">Always down (floor)</SelectItem>
                    <SelectItem value="up">Always up (ceil)</SelectItem>
                    <SelectItem value="none">No rounding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice number prefix</Label>
                <Input defaultValue="INV" />
              </div>
              <div className="space-y-2">
                <Label>Next invoice number</Label>
                <Input defaultValue="00183" />
              </div>
            </CardContent>
          </CardCanvas>
        </TabsContent>

        <TabsContent value="integrations" className="mt-0">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">
                <span className="inline-flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-muted" />
                  Integrations
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {[
                { name: "Tally / Busy export", desc: "Sync invoices to Tally Prime or Busy.", status: "Coming soon", variant: "secondary" as const },
                { name: "GSTN e-invoice", desc: "IRN & QR code generation via NIC gateway.", status: "Coming soon", variant: "secondary" as const },
                { name: "WhatsApp for invoice delivery", desc: "Send PDF invoice via WhatsApp Business API.", status: "Coming soon", variant: "secondary" as const },
                { name: "Payment links", desc: "Collect credit card / UPI from customers.", status: "Coming soon", variant: "secondary" as const },
              ].map((i) => (
                <div
                  key={i.name}
                  className="flex items-start justify-between gap-4 rounded-lg border border-hairline bg-canvas p-4"
                >
                  <div>
                    <p className="text-nav-link font-semibold text-ink">{i.name}</p>
                    <p className="mt-1 text-caption text-muted">{i.desc}</p>
                  </div>
                  <Badge variant={i.variant}>{i.status}</Badge>
                </div>
              ))}
            </CardContent>
          </CardCanvas>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

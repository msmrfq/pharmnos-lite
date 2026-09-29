import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardCanvas,
  CardContent,
  CardDescription,
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
import { ArrowLeft, FileSpreadsheet, Save } from "lucide-react";

export const metadata: Metadata = {
  title: "Add product",
};

export default function NewProductPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/inventory" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">Add product</CardTitle>
            <CardDescription>
              Register a new product master. Batches will be created from purchase entries.
            </CardDescription>
          </div>
        </div>
        <Button>
          <Save className="h-4 w-4" /> Save product
        </Button>
      </CardHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">
                <span className="inline-flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted" />
                  Basic information
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Product name</Label>
                <Input placeholder="Paracetamol 500mg Tablet" />
              </div>
              <div className="space-y-2">
                <Label>Generic / salt name</Label>
                <Input placeholder="Paracetamol IP 500mg" />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer / brand</Label>
                <Input placeholder="Cipla / Dolo" />
              </div>
              <div className="space-y-2">
                <Label>Dosage form</Label>
                <Select defaultValue="tablet">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tablet">Tablet</SelectItem>
                    <SelectItem value="capsule">Capsule</SelectItem>
                    <SelectItem value="syrup">Syrup / Liquid</SelectItem>
                    <SelectItem value="injection">Injection</SelectItem>
                    <SelectItem value="cream">Cream / Ointment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Packing</Label>
                <Input placeholder="10 x 10 tablets" />
              </div>
              <div className="space-y-2">
                <Label>Schedule class</Label>
                <Select defaultValue="otc">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="otc">OTC — over the counter</SelectItem>
                    <SelectItem value="h">Schedule H — prescription</SelectItem>
                    <SelectItem value="h1">Schedule H1 — narcotics</SelectItem>
                    <SelectItem value="x">Schedule X</SelectItem>
                    <SelectItem value="ayurvedic">Ayurvedic / OTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Pricing &amp; tax</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>MRP</Label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Default purchase rate</Label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Default sale rate</Label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>GST rate (%)</Label>
                <Select defaultValue="12">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 % Exempt</SelectItem>
                    <SelectItem value="5">5 %</SelectItem>
                    <SelectItem value="12">12 %</SelectItem>
                    <SelectItem value="18">18 %</SelectItem>
                    <SelectItem value="28">28 %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Inventory defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <Label>Reorder level</Label>
                <Input type="number" defaultValue={50} />
              </div>
              <div className="space-y-2">
                <Label>Default unit</Label>
                <Select defaultValue="strip">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strip">Strip</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="bottle">Bottle</SelectItem>
                    <SelectItem value="each">Each / tablet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SKU / code</Label>
                <Input placeholder="Auto-generate or type custom" />
              </div>
            </CardContent>
          </CardCanvas>
        </div>
      </div>
    </DashboardLayout>
  );
}

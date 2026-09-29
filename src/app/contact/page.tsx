import MarketingLayout from "@/components/layout/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CardCanvas,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Phone, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <MarketingLayout>
      <section className="container-editorial py-20 md:py-24">
        <div className="mx-auto max-w-2xl text-center mb-14 space-y-4">
          <h1 className="font-display tracking-tight text-display-md md:text-display-lg text-ink">
            Talk to our team
          </h1>
          <p className="text-body-md text-body">
            Questions on onboarding, migration, or multi-branch setups? We&apos;ll reply
            within 1 business day.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] max-w-6xl mx-auto">
          <div className="space-y-5">
            {[
              {
                icon: Mail,
                title: "Email",
                value: "sales@pharmnos.in",
                desc: "For sales, partnership, and demos",
              },
              {
                icon: Phone,
                title: "Phone",
                value: "+91 80 0000 0000",
                desc: "Mon-Sat · 10am–7pm IST",
              },
              {
                icon: MapPin,
                title: "HQ",
                value: "Pune, Maharashtra, India",
                desc: "Remote-first team across India",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <CardCanvas key={c.title}>
                  <CardContent className="flex items-start gap-4 p-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-card text-ink">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                        {c.title}
                      </p>
                      <p className="text-title-sm font-semibold text-ink mt-1">{c.value}</p>
                      <p className="text-body-sm text-muted">{c.desc}</p>
                    </div>
                  </CardContent>
                </CardCanvas>
              );
            })}
          </div>
          <CardCanvas>
            <CardHeader>
              <CardTitle>Request a demo or quote</CardTitle>
              <CardDescription>
                Tell us about your business and we&apos;ll follow up with a tailored walkthrough.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+91 …" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz">Business name</Label>
                <Input id="biz" placeholder="Your pharmacy or distribution company" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.in" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">How can we help?</Label>
                <Textarea
                  id="notes"
                  placeholder="Number of branches, monthly invoices, current system you're migrating from…"
                  rows={5}
                />
              </div>
              <Button size="lg" className="w-full sm:w-auto">
                Submit request
              </Button>
            </CardContent>
          </CardCanvas>
        </div>
      </section>
    </MarketingLayout>
  );
}

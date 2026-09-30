import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CardCanvas,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import { AUDIT_BADGE_MAP, AUDIT_EVENT_LABELS } from "@/lib/constants/audit";
import type { AuditEventType } from "@prisma/client";

export const metadata: Metadata = {
  title: "Audit log",
};

function buildQs(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const merged = { ...base, ...overrides };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "" && v !== null) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function formatTimestamp(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortCuid(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 10 ? id.slice(0, 10) : id;
}

function truncateMetadata(meta: unknown, maxLen = 100): string {
  if (meta === null || meta === undefined) return "—";
  let str: string;
  if (typeof meta === "string") {
    str = meta;
  } else {
    try {
      str = JSON.stringify(meta);
    } catch {
      str = String(meta);
    }
  }
  if (str.length <= maxLen) return str || "—";
  return str.slice(0, maxLen) + "…";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    q?: string;
    userId?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
  };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 25;
  const q = searchParams?.q ?? "";
  const userId = searchParams?.userId ?? "";
  const eventType = searchParams?.eventType ?? "";
  const startDate = searchParams?.startDate ?? "";
  const endDate = searchParams?.endDate ?? "";
  let dbOk = isPostgresConfigured();

  let items: any[] = [];
  let total = 0;
  let users: any[] = [];

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const [result, usersResult] = await Promise.all([
        repos.auditLogs.list(
          {
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { created_at: "desc" },
            search: q || undefined,
            userId: userId || undefined,
            eventType: (eventType as AuditEventType) || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          ctx,
        ),
        repos.users.listForTenant(
          { skip: 0, take: 500, orderBy: { full_name: "asc" } },
          ctx,
        ),
      ]);
      items = result.items;
      total = result.total;
      users = usersResult.items;
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(q || userId || eventType || startDate || endDate);

  const baseQs: Record<string, string | undefined> = {
    q: q || undefined,
    userId: userId || undefined,
    eventType: eventType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const eventTypeKeys = Object.keys(AUDIT_BADGE_MAP) as AuditEventType[];

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Audit log</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Immutable record of every change in the workspace.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Database is not configured — showing empty grid.
            </p>
          )}
        </div>
      </CardHeader>

      {!dbOk && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">
              Showing empty table until database is connected.
            </strong>
            <span className="ml-1">
              Temporary Supabase pooler timeout — retry in 60 seconds.
            </span>
          </div>
        </div>
      )}

      <CardCanvas className="mb-5">
        <CardContent className="pt-4">
          <form
            action="/audit"
            method="get"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 items-end"
          >
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Target, ref, IP…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="userId">User</Label>
              <Select name="userId" defaultValue={userId || "all"}>
                <SelectTrigger id="userId">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eventType">Event type</Label>
              <Select name="eventType" defaultValue={eventType || "all"}>
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  {eventTypeKeys.map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUDIT_EVENT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">From date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">To date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={endDate}
              />
            </div>
            <div className="flex gap-2 lg:col-span-6 justify-end">
              <Button type="submit">Apply</Button>
              {hasFilters && (
                <Button type="button" variant="secondary" asChild>
                  <Link href="/audit">
                    <X className="h-4 w-4" /> Clear
                  </Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </CardCanvas>

      {dbOk && items.length === 0 ? (
        <CardCanvas>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-soft mb-4">
              <FileText className="h-8 w-8 text-muted" />
            </div>
            <h3 className="text-title-md font-semibold text-ink mb-2">
              No audit entries found
            </h3>
            <p className="text-body-md text-body max-w-sm mb-5">
              {hasFilters
                ? "No records match the current filters. Try clearing filters or adjusting the date range."
                : "Audit activity will appear here once users start creating, updating, or finalizing records."}
            </p>
            {hasFilters && (
              <Button variant="secondary" asChild>
                <Link href="/audit">
                  <X className="h-4 w-4" /> Clear all filters
                </Link>
              </Button>
            )}
          </CardContent>
        </CardCanvas>
      ) : (
        <>
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!dbOk ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted text-body-md"
                      >
                        Showing placeholder rows until database is connected.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((l: any) => {
                      const et = l.event_type as AuditEventType;
                      const label = AUDIT_EVENT_LABELS[et] || et;
                      const variant = AUDIT_BADGE_MAP[et] || "default";
                      const actorName =
                        l.actor?.full_name ||
                        l.actor?.email ||
                        (l.actor_id ? "Unknown user" : "System");
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-body text-caption whitespace-nowrap">
                            {formatTimestamp(l.created_at)}
                          </TableCell>
                          <TableCell className="text-body">
                            {actorName}
                          </TableCell>
                          <TableCell className="text-body">
                            {l.target_type ? (
                              <Badge variant="outline">
                                {l.target_type}
                              </Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={variant}>
                              <ClipboardList className="h-3 w-3 mr-1" />
                              {label}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="font-mono text-caption text-ink"
                            title={l.target_id || undefined}
                          >
                            {shortCuid(l.target_id)}
                          </TableCell>
                          <TableCell
                            className="text-body max-w-[300px]"
                            title={
                              typeof l.metadata === "string"
                                ? l.metadata
                                : l.metadata
                                  ? JSON.stringify(l.metadata)
                                  : undefined
                            }
                          >
                            {truncateMetadata(l.metadata)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-caption text-muted">
              Showing {dbOk ? Math.min(items.length, total) : 0} of {total} entries · Page {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                asChild
                aria-disabled={page <= 1}
                className={page <= 1 ? "opacity-60 pointer-events-none" : ""}
              >
                <Link
                  href={
                    page <= 1
                      ? `/audit${buildQs(baseQs)}`
                      : `/audit${buildQs(baseQs, { page: String(page - 1) })}`
                  }
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                asChild
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages ? "opacity-60 pointer-events-none" : ""
                }
              >
                <Link
                  href={`/audit${buildQs(baseQs, { page: String(page + 1) })}`}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}

      <p className="mt-5 text-caption text-muted">
        Read-only. Audit logs are immutable and cannot be edited or deleted.
      </p>
    </DashboardLayout>
  );
}

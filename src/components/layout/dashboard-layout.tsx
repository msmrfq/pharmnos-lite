"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PackagePlus,
  Warehouse,
  Users,
  Truck,
  BarChart3,
  ClipboardList,
  Settings,
  Pill,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Receipt,
  PackagePlus,
  Warehouse,
  Users,
  Truck,
  BarChart3,
  ClipboardList,
  Settings,
};

const sidebarNav = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "billing", label: "Billing", href: "/billing", icon: "Receipt" },
  { key: "purchases", label: "Purchases", href: "/purchases", icon: "PackagePlus" },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: "Warehouse" },
  { key: "customers", label: "Customers", href: "/customers", icon: "Users" },
  { key: "suppliers", label: "Suppliers", href: "/suppliers", icon: "Truck" },
  { key: "reports", label: "Reports", href: "/reports", icon: "BarChart3" },
  { key: "audit", label: "Audit Log", href: "/audit", icon: "ClipboardList" },
];

const settingsNav = [
  { key: "settings", label: "Settings", href: "/settings", icon: "Settings" },
];

type DashboardLayoutProps = {
  tenantName?: string;
  userName?: string;
  userInitials?: string;
  children: React.ReactNode;
  header?: React.ReactNode;
};

export function DashboardLayout(props: DashboardLayoutProps) {
  const {
    tenantName = "Your Pharmacy",
    userName = "User",
    userInitials = "US",
    children,
    header,
  } = props;

  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nav = [...sidebarNav, ...settingsNav];

  return (
    <div className="flex min-h-dvh bg-surface-soft/30">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-hairline bg-canvas transition-transform duration-200 lg:static lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-hairline-soft px-5">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Pill className="h-4 w-4 text-on-primary" strokeWidth={2.25} />
              </span>
              <span className="text-title-md font-semibold tracking-brand text-ink">
                Pharmnos<span className="text-muted font-medium"> Lite</span>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tenant context */}
          <div className="border-b border-hairline-soft px-5 py-4">
            <p className="text-caption text-muted">Business</p>
            <p className="text-title-sm font-semibold text-ink truncate">{tenantName}</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
            {sidebarNav.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-nav-link transition-none",
                    isActive
                      ? "bg-surface-card text-ink font-semibold"
                      : "text-body hover:bg-surface-soft hover:text-ink",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

            <div className="mt-4 pt-4 border-t border-hairline-soft">
              {settingsNav.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-nav-link transition-none",
                      isActive
                        ? "bg-surface-card text-ink font-semibold"
                        : "text-body hover:bg-surface-soft hover:text-ink",
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer profile */}
          <div className="border-t border-hairline-soft p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-surface-soft transition-none">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-surface-card text-ink font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-nav-link font-medium text-ink truncate">{userName}</p>
                    <p className="text-caption text-muted truncate">Administrator</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/business">Business Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-semantic-error">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-hairline bg-canvas/90 backdrop-blur">
          <div className="flex h-full items-center gap-3 px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1 min-w-0 max-w-xl hidden sm:block">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  placeholder="Search products, customers, invoices..."
                  className="pl-9 bg-surface-soft/50 border-transparent focus:bg-canvas"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-hairline mx-1 hidden sm:block" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 hidden sm:inline-flex">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-surface-card text-ink text-[11px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-nav-link font-medium">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/settings/profile">My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/business">Business Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-semantic-error">
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page header slot */}
        {header}

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
}

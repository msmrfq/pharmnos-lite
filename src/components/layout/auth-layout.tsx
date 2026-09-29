import Link from "next/link";
import { Pill } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 flex h-96 justify-center">
        <div className="h-96 w-full max-w-5xl bg-gradient-to-b from-surface-card via-canvas to-transparent blur-3xl opacity-60" />
      </div>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Pill className="h-5 w-5 text-on-primary" strokeWidth={2.25} />
          </span>
          <span className="text-title-lg font-semibold tracking-brand text-ink">
            Pharmnos<span className="text-muted font-medium"> Lite</span>
          </span>
        </Link>
        <div className="rounded-xl bg-canvas border border-hairline p-8 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
          {children}
        </div>
        <p className="mt-6 text-center text-body-sm text-muted">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

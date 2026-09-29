"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import AuthLayout from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInAction, type ActionResult } from "@/app/auth/_actions/auth.actions";

const initialState: ActionResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export default function SignInPage() {
  useEffect(() => {
    document.title = "Sign in — Pharmnos Lite";
  }, []);
  const [state, formAction] = useFormState(signInAction, initialState);

  return (
    <AuthLayout>
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-display-sm tracking-brand">Welcome back</CardTitle>
          <CardDescription>Sign in to your Pharmnos Lite workspace.</CardDescription>
        </CardHeader>
        <form action={formAction} noValidate>
          <CardContent className="space-y-5 px-0">
            {state?.ok === false && state.message && (
              <div
                role="alert"
                className="rounded-sm border border-destructive/50 bg-destructive/5 px-3 py-2 text-body-sm text-destructive"
              >
                {state.message}
              </div>
            )}
            {state?.ok && state.message && (
              <div
                role="status"
                className="rounded-sm border border-success/50 bg-success/5 px-3 py-2 text-body-sm"
              >
                {state.message}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="owner@pharmacy.in"
                aria-invalid={!!state.errors?.email}
                aria-describedby="email-error"
              />
              {state.errors?.email && (
                <p id="email-error" className="text-caption text-destructive">
                  {state.errors.email[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-caption text-muted hover:text-ink transition-none"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!state.errors?.password}
                aria-describedby="password-error"
              />
              {state.errors?.password && (
                <p id="password-error" className="text-caption text-destructive">
                  {state.errors.password[0]}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-body-sm text-muted select-none">
              <input
                type="checkbox"
                name="remember"
                defaultChecked
                className="h-4 w-4 rounded border-hairline text-primary focus:ring-primary"
              />
              Remember me on this device
            </label>
            <SubmitButton />
          </CardContent>
        </form>
        <CardFooter className="px-0 pb-0 justify-center">
          <p className="text-body-sm text-muted">
            New to Pharmnos Lite?{" "}
            <Link href="/auth/sign-up" className="text-ink font-medium hover:underline">
              Create a workspace
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}

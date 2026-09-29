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
import { signUpAction, type ActionResult } from "@/app/auth/_actions/auth.actions";

const initialState: ActionResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Creating workspace…" : "Create workspace"}
    </Button>
  );
}

export default function SignUpPage() {
  useEffect(() => {
    document.title = "Create workspace — Pharmnos Lite";
  }, []);
  const [state, formAction] = useFormState(signUpAction, initialState);
  const needsVerification =
    state.ok &&
    !!(state.data as { needsVerification?: boolean } | undefined)?.needsVerification;

  return (
    <AuthLayout>
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-display-sm tracking-brand">Create your workspace</CardTitle>
          <CardDescription>
            Start free. You can add staff and load data in the setup wizard.
          </CardDescription>
        </CardHeader>
        <form action={formAction} noValidate>
          <CardContent className="space-y-4">
            {state?.ok === false && state.message && (
              <div
                role="alert"
                className="rounded-sm border border-destructive/50 bg-destructive/5 px-3 py-2 text-body-sm text-destructive"
              >
                {state.message}
              </div>
            )}
            {needsVerification && state.message && (
              <div
                role="status"
                className="rounded-sm border border-success/50 bg-success/5 px-3 py-2 text-body-sm"
              >
                {state.message}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Rajesh Kumar"
                aria-invalid={!!state.errors?.fullName}
                aria-describedby="fullName-error"
              />
              {state.errors?.fullName && (
                <p id="fullName-error" className="text-caption text-destructive">
                  {state.errors.fullName[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                name="businessName"
                placeholder="Maharashtra Pharma Distributors"
                aria-invalid={!!state.errors?.businessName}
                aria-describedby="businessName-error"
              />
              {state.errors?.businessName && (
                <p id="businessName-error" className="text-caption text-destructive">
                  {state.errors.businessName[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="owner@yourpharmacy.in"
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
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98 0000 0000"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  aria-invalid={!!state.errors?.password}
                  aria-describedby="password-error"
                />
                {state.errors?.password && (
                  <p id="password-error" className="text-caption text-destructive">
                    {state.errors.password[0]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  aria-invalid={!!state.errors?.confirmPassword}
                  aria-describedby="confirmPassword-error"
                />
                {state.errors?.confirmPassword && (
                  <p id="confirmPassword-error" className="text-caption text-destructive">
                    {state.errors.confirmPassword[0]}
                  </p>
                )}
              </div>
            </div>
            <SubmitButton />
          </CardContent>
        </form>
        <CardFooter className="px-0 pb-0 justify-center">
          <p className="text-body-sm text-muted">
            Already have a workspace?{" "}
            <Link href="/auth/sign-in" className="text-ink font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}

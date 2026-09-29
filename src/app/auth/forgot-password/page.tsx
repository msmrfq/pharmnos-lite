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
import { forgotPasswordAction, type ActionResult } from "@/app/auth/_actions/auth.actions";

const initialState: ActionResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Sending link…" : "Send reset link"}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  useEffect(() => {
    document.title = "Forgot password — Pharmnos Lite";
  }, []);
  const [state, formAction] = useFormState(forgotPasswordAction, initialState);

  return (
    <AuthLayout>
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-display-sm tracking-brand">Reset your password</CardTitle>
          <CardDescription>
            We&apos;ll send a reset link to your registered email.
          </CardDescription>
        </CardHeader>
        <form action={formAction} noValidate>
          <CardContent className="space-y-5">
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
            <SubmitButton />
          </CardContent>
        </form>
        <CardFooter className="px-0 pb-0 justify-center">
          <p className="text-body-sm text-muted">
            Remembered it?{" "}
            <Link href="/auth/sign-in" className="text-ink font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}

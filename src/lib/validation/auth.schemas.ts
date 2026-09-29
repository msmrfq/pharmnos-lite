import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean().optional(),
});

export const signUpSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    businessName: z.string().min(2, "Business name is required"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const inviteUserSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
  roleId: z.string().min(1, "A role is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

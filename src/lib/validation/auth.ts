import { z } from "zod";
import { isAllowlistedRedirectPath } from "@/lib/auth/routes";

// Password policy constants
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,128}$/;

export const passwordSchema = z
  .string({
    required_error: "Password is required",
  })
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
  )
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one digit")
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    "Password must contain at least one allowed symbol",
  );

export const CompleteInviteSchema = z.object({
  token: z
    .string({
      required_error: "Token is required",
    })
    .min(43, "Token must be at least 43 characters")
    .max(128, "Token must not exceed 128 characters"),
  full_name: z
    .string({
      required_error: "Full name is required",
    })
    .trim()
    .min(1, "Full name must not be empty")
    .max(120, "Full name must not exceed 120 characters"),
  phone_e164: z
    .string()
    .regex(
      /^\+[1-9][0-9]{7,14}$/,
      "Phone number must be valid E.164 format (e.g. +525512345678)",
    )
    .nullable()
    .optional(),
  password: passwordSchema,
  whatsapp_opt_in: z.boolean().default(false).optional(),
});

export type CompleteInviteInput = z.infer<typeof CompleteInviteSchema>;

export const MagicLinkSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
    })
    .email("Invalid email address")
    .max(320, "Email must not exceed 320 characters"),
  redirect_path: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) =>
        val === null || val === undefined || isAllowlistedRedirectPath(val),
      {
        message:
          "Redirect path must be an allowlisted relative application path",
      },
    ),
});

export type MagicLinkInput = z.infer<typeof MagicLinkSchema>;

export const SignInSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
    })
    .email("Invalid email address")
    .max(320, "Email must not exceed 320 characters"),
  password: z
    .string({
      required_error: "Password is required",
    })
    .min(1, "Password is required")
    .max(PASSWORD_MAX_LENGTH, "Password is too long"),
});

export type SignInInput = z.infer<typeof SignInSchema>;

export const PasswordUpdateSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z
      .string({
        required_error: "Password confirmation is required",
      })
      .min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type PasswordUpdateInput = z.infer<typeof PasswordUpdateSchema>;

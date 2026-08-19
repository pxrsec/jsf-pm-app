import { describe, it, expect } from "vitest";
import {
  CompleteInviteSchema,
  MagicLinkSchema,
  SignInSchema,
  PasswordUpdateSchema,
  passwordSchema,
} from "@/lib/validation/auth";

describe("Auth Validation Schemas", () => {
  describe("Password Policy", () => {
    it("accepts passwords satisfying all policy requirements", () => {
      const validPasswords = [
        "Str0ng!Passw0rd",
        "Valid1234#Pass",
        "Abcd!234Efgh5678",
        "Complex_Pass_2026!",
      ];
      for (const pass of validPasswords) {
        const res = passwordSchema.safeParse(pass);
        expect(res.success).toBe(true);
      }
    });

    it("rejects passwords under 12 characters", () => {
      const res = passwordSchema.safeParse("Short1!a");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("at least 12 characters");
      }
    });

    it("rejects passwords missing uppercase letters", () => {
      const res = passwordSchema.safeParse("lowercase1234!");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("uppercase");
      }
    });

    it("rejects passwords missing lowercase letters", () => {
      const res = passwordSchema.safeParse("UPPERCASE1234!");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("lowercase");
      }
    });

    it("rejects passwords missing digits", () => {
      const res = passwordSchema.safeParse("NoDigitsAllowed!");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("digit");
      }
    });

    it("rejects passwords missing symbols", () => {
      const res = passwordSchema.safeParse("NoSymbolsAllowed123");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("symbol");
      }
    });
  });

  describe("CompleteInviteSchema", () => {
    const validPayload = {
      token: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde123",
      full_name: "Ana Torres",
      phone_e164: "+525512345678",
      password: "Str0ng!Passw0rd",
      whatsapp_opt_in: true,
    };

    it("accepts valid completion payload", () => {
      const res = CompleteInviteSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
    });

    it("accepts null or omitted optional fields", () => {
      const minimalPayload = {
        token: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde123",
        full_name: "Ana Torres",
        password: "Str0ng!Passw0rd",
      };
      const res = CompleteInviteSchema.safeParse(minimalPayload);
      expect(res.success).toBe(true);
    });

    it("rejects tokens shorter than 43 characters", () => {
      const res = CompleteInviteSchema.safeParse({
        ...validPayload,
        token: "too_short_token",
      });
      expect(res.success).toBe(false);
    });

    it("rejects empty full_name", () => {
      const res = CompleteInviteSchema.safeParse({
        ...validPayload,
        full_name: "   ",
      });
      expect(res.success).toBe(false);
    });

    it("rejects invalid phone number formats", () => {
      const res = CompleteInviteSchema.safeParse({
        ...validPayload,
        phone_e164: "5512345678", // Missing + prefix
      });
      expect(res.success).toBe(false);
    });
  });

  describe("MagicLinkSchema", () => {
    it("accepts valid email and allowlisted relative redirect path", () => {
      const res = MagicLinkSchema.safeParse({
        email: "user@example.com",
        redirect_path: "/pm",
      });
      expect(res.success).toBe(true);
    });

    it("accepts null redirect path", () => {
      const res = MagicLinkSchema.safeParse({
        email: "user@example.com",
        redirect_path: null,
      });
      expect(res.success).toBe(true);
    });

    it("rejects invalid email formats", () => {
      const res = MagicLinkSchema.safeParse({
        email: "not-an-email",
        redirect_path: "/pm",
      });
      expect(res.success).toBe(false);
    });

    it("rejects absolute/external URLs (open-redirect protection)", () => {
      const res = MagicLinkSchema.safeParse({
        email: "user@example.com",
        redirect_path: "https://evil.example.com",
      });
      expect(res.success).toBe(false);
    });

    it("rejects protocol-relative double slash paths", () => {
      const res = MagicLinkSchema.safeParse({
        email: "user@example.com",
        redirect_path: "//evil.example.com",
      });
      expect(res.success).toBe(false);
    });

    it("rejects paths with backslashes", () => {
      const res = MagicLinkSchema.safeParse({
        email: "user@example.com",
        redirect_path: "/\\evil.example.com",
      });
      expect(res.success).toBe(false);
    });

    it("rejects non-allowlisted application paths", () => {
      const res = MagicLinkSchema.safeParse({
        email: "user@example.com",
        redirect_path: "/unauthorized/secret",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("SignInSchema", () => {
    it("accepts valid email and password", () => {
      const res = SignInSchema.safeParse({
        email: "demo@jsf.internal",
        password: "SomePassword123!",
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty password", () => {
      const res = SignInSchema.safeParse({
        email: "demo@jsf.internal",
        password: "",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("PasswordUpdateSchema", () => {
    it("accepts matching compliant passwords", () => {
      const res = PasswordUpdateSchema.safeParse({
        password: "NewPassword123!",
        confirm_password: "NewPassword123!",
      });
      expect(res.success).toBe(true);
    });

    it("rejects non-matching passwords", () => {
      const res = PasswordUpdateSchema.safeParse({
        password: "NewPassword123!",
        confirm_password: "DifferentPassword123!",
      });
      expect(res.success).toBe(false);
    });
  });
});

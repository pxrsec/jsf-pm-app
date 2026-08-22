import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`);
    (error as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
}));

vi.mock("@/lib/auth/session", () => {
  class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  }

  return {
    AuthError,
    requireSession: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { unread_count: 0 },
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/shell-data/shell-queries", () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/components/shared/app-nav/app-nav", () => ({
  AppNav: () => null,
}));

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, AuthError } from "@/lib/auth/session";
import ProtectedLayout from "@/app/[locale]/(protected)/layout";

describe("Protected Route Guard (src/app/(protected)/layout.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({
      getAll: vi.fn().mockResolvedValue([]),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it("redirects unauthenticated request to /iniciar-sesion", async () => {
    vi.mocked(requireSession).mockRejectedValue(
      new AuthError("UNAUTHENTICATED", "No active session"),
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("NEXT_REDIRECT: /iniciar-sesion");
    expect(redirect).toHaveBeenCalledWith("/iniciar-sesion");
  });

  it("redirects inactive profile to /sesion-expirada?reason=inactive", async () => {
    vi.mocked(requireSession).mockRejectedValue(
      new AuthError(
        "INACTIVE_OR_MISSING_PROFILE",
        "Profile inactive or deleted",
      ),
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("NEXT_REDIRECT: /sesion-expirada?reason=inactive");
    expect(redirect).toHaveBeenCalledWith("/sesion-expirada?reason=inactive");
  });

  it("re-throws unexpected errors from requireSession", async () => {
    vi.mocked(requireSession).mockRejectedValue(
      new Error("Unexpected DB crash"),
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("Unexpected DB crash");
  });

  it("redirects admin user requesting /pm to /admin", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-1", email: "admin@jsf.internal" },
      profile: {
        id: "user-1",
        full_name: "Admin User",
        role: "admin",
        is_active: true,
        deleted_at: null,
      },
      role: "admin",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/pm" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("NEXT_REDIRECT: /admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });

  it("redirects pm user requesting /admin to /pm", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-2", email: "pm@jsf.internal" },
      profile: {
        id: "user-2",
        full_name: "PM User",
        role: "pm",
        is_active: true,
        deleted_at: null,
      },
      role: "pm",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/admin" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("NEXT_REDIRECT: /pm");
    expect(redirect).toHaveBeenCalledWith("/pm");
  });

  it("redirects operator user requesting /cliente to /operador", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-3", email: "op@jsf.internal" },
      profile: {
        id: "user-3",
        full_name: "Operator User",
        role: "operator",
        is_active: true,
        deleted_at: null,
      },
      role: "operator",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/cliente" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("NEXT_REDIRECT: /operador");
    expect(redirect).toHaveBeenCalledWith("/operador");
  });

  it("redirects client user requesting /operador to /cliente", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-4", email: "client@acme.internal" },
      profile: {
        id: "user-4",
        full_name: "Client User",
        role: "client",
        is_active: true,
        deleted_at: null,
      },
      role: "client",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/operador" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    await expect(
      ProtectedLayout({ children: "child content" }),
    ).rejects.toThrow("NEXT_REDIRECT: /cliente");
    expect(redirect).toHaveBeenCalledWith("/cliente");
  });

  it("allows matching role path /admin for admin user without redirect", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-1", email: "admin@jsf.internal" },
      profile: {
        id: "user-1",
        full_name: "Admin User",
        role: "admin",
        is_active: true,
        deleted_at: null,
      },
      role: "admin",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/admin" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    const result = await ProtectedLayout({ children: "test content" });
    expect(result).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows matching role path /pm for pm user without redirect", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-2", email: "pm@jsf.internal" },
      profile: {
        id: "user-2",
        full_name: "PM User",
        role: "pm",
        is_active: true,
        deleted_at: null,
      },
      role: "pm",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/pm" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    const result = await ProtectedLayout({ children: "test content" });
    expect(result).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows matching role path /operador for operator user without redirect", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-3", email: "op@jsf.internal" },
      profile: {
        id: "user-3",
        full_name: "Operator User",
        role: "operator",
        is_active: true,
        deleted_at: null,
      },
      role: "operator",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/operador" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    const result = await ProtectedLayout({ children: "test content" });
    expect(result).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows matching role path /cliente for client user without redirect", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-4", email: "client@acme.internal" },
      profile: {
        id: "user-4",
        full_name: "Client User",
        role: "client",
        is_active: true,
        deleted_at: null,
      },
      role: "client",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-pathname": "/cliente" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >,
    );

    const result = await ProtectedLayout({ children: "test content" });
    expect(result).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  describe("Shared Authenticated Routes (/notificaciones)", () => {
    const roles: Array<{
      role: "admin" | "pm" | "operator" | "client";
      id: string;
      defaultPath: string;
    }> = [
      { role: "admin", id: "user-1", defaultPath: "/admin" },
      { role: "pm", id: "user-2", defaultPath: "/pm" },
      { role: "operator", id: "user-3", defaultPath: "/operador" },
      { role: "client", id: "user-4", defaultPath: "/cliente" },
    ];

    roles.forEach(({ role, id }) => {
      it(`allows ${role} user to access /notificaciones without redirect`, async () => {
        vi.mocked(requireSession).mockResolvedValue({
          user: { id, email: `${role}@jsf.internal` },
          profile: {
            id,
            full_name: `${role} User`,
            role,
            is_active: true,
            deleted_at: null,
          },
          role,
        } as unknown as Awaited<ReturnType<typeof requireSession>>);

        vi.mocked(headers).mockResolvedValue(
          new Headers({
            "x-pathname": "/notificaciones",
          }) as unknown as Awaited<ReturnType<typeof headers>>,
        );

        const result = await ProtectedLayout({
          children: "notifications page",
        });
        expect(result).toBeDefined();
        expect(redirect).not.toHaveBeenCalled();
      });

      it(`allows ${role} user to access /en/notificaciones without redirect`, async () => {
        vi.mocked(requireSession).mockResolvedValue({
          user: { id, email: `${role}@jsf.internal` },
          profile: {
            id,
            full_name: `${role} User`,
            role,
            is_active: true,
            deleted_at: null,
          },
          role,
        } as unknown as Awaited<ReturnType<typeof requireSession>>);

        vi.mocked(headers).mockResolvedValue(
          new Headers({
            "x-pathname": "/en/notificaciones",
          }) as unknown as Awaited<ReturnType<typeof headers>>,
        );

        const result = await ProtectedLayout({
          children: "notifications page",
        });
        expect(result).toBeDefined();
        expect(redirect).not.toHaveBeenCalled();
      });
    });

    it("denies unlisted shared-looking route /notificaciones-interna and redirects to role home", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-3", email: "op@jsf.internal" },
        profile: {
          id: "user-3",
          full_name: "Operator User",
          role: "operator",
          is_active: true,
          deleted_at: null,
        },
        role: "operator",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          "x-pathname": "/notificaciones-interna",
        }) as unknown as Awaited<ReturnType<typeof headers>>,
      );

      await expect(
        ProtectedLayout({ children: "child content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /operador");
      expect(redirect).toHaveBeenCalledWith("/operador");
    });

    it("allows admin user to access /admin/notificaciones and /en/admin/notificaciones without redirect", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-1", email: "admin@jsf.internal" },
        profile: {
          id: "user-1",
          full_name: "Admin User",
          role: "admin",
          is_active: true,
          deleted_at: null,
        },
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          "x-pathname": "/admin/notificaciones",
        }) as unknown as Awaited<ReturnType<typeof headers>>,
      );

      const result = await ProtectedLayout({ children: "admin queue page" });
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("allows pm user to access /pm/notificaciones and /en/pm/notificaciones without layout redirect", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-2", email: "pm@jsf.internal" },
        profile: {
          id: "user-2",
          full_name: "PM User",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          "x-pathname": "/pm/notificaciones",
        }) as unknown as Awaited<ReturnType<typeof headers>>,
      );

      const result = await ProtectedLayout({ children: "pm queue page" });
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("redirects admin requesting /pm/notificaciones to /admin", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-1", email: "admin@jsf.internal" },
        profile: {
          id: "user-1",
          full_name: "Admin User",
          role: "admin",
          is_active: true,
          deleted_at: null,
        },
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          "x-pathname": "/pm/notificaciones",
        }) as unknown as Awaited<ReturnType<typeof headers>>,
      );

      await expect(
        ProtectedLayout({ children: "child content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /admin");
      expect(redirect).toHaveBeenCalledWith("/admin");
    });

    it("redirects pm requesting /admin/notificaciones to /pm", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-2", email: "pm@jsf.internal" },
        profile: {
          id: "user-2",
          full_name: "PM User",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          "x-pathname": "/admin/notificaciones",
        }) as unknown as Awaited<ReturnType<typeof headers>>,
      );

      await expect(
        ProtectedLayout({ children: "child content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /pm");
      expect(redirect).toHaveBeenCalledWith("/pm");
    });
  });
});

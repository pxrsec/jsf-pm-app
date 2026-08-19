import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { SignInForm } from "./_components/sign-in-form";

export default async function SignInPage() {
  const cookieStore = await cookies();
  const session = await getOptionalSession(cookieStore);

  if (session) {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <SignInForm />
    </main>
  );
}

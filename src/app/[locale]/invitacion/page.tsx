import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { InvitationForm } from "./_components/invitation-form";

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token || token.trim().length < 43) {
    redirect("/sesion-expirada?reason=invalid");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <InvitationForm token={token} />
    </main>
  );
}

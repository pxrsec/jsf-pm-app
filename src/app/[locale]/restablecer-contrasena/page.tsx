import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ResetPasswordForm } from "./_components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <ResetPasswordForm />
    </main>
  );
}

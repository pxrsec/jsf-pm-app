import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/shared/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "shell.brand" });
  return {
    title: t("name"),
    description: t("name"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}

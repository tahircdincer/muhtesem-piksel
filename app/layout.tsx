import type { Metadata } from "next";
import "@fontsource-variable/archivo/wdth.css";
import { lang, strings } from "@/lib/strings";
import "./globals.css";

export const metadata: Metadata = {
  title: strings.appName,
  description: strings.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

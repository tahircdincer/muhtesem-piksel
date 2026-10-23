import type { Metadata } from "next";
import { strings } from "@/lib/strings";
import "./globals.css";

export const metadata: Metadata = {
  title: strings.appName,
  description: strings.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

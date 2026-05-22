import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamFrame",
  description:
    "A lightweight HR structure system for startups with 6–25 employees. Installed in 48–72 hours.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

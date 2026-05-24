import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamFrame",
  description:
    "Payroll input layer for startup finance teams. Export-ready employee dataset system installed in 48–72 hours.",
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

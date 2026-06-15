import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "motionforge chat",
  description: "Generate, preview, patch, and export motionforge scenes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

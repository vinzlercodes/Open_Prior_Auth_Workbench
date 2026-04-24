import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Prior Auth Workbench",
  description: "M1 requirements sandbox for MRI lumbar spine prior authorization"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

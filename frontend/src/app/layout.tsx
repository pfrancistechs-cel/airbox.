import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AirBox",
  description: "Distributed content-addressed file synchronization platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


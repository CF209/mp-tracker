import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MP Tracker",
  description: "Subscribe to Mountain Project routes and track activity over time",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

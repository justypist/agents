import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agents",
  description: "Agents Web 应用，支持安装为独立 PWA。",
  applicationName: "Agents",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agents",
  },
  icons: {
    icon: [
      {
        url: "/api/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/api/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/api/pwa-icon/180",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#fafafa",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#0a0a0a",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}

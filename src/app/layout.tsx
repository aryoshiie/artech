import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARTECH · Multi-Agent Orchestrator",
  description: "Artech Orchestrator — pusat kendali multi-agent dengan visualisasi tata surya. Terhubung ke workflow n8n Anda.",
  keywords: ["Artech", "multi-agent", "orchestrator", "n8n", "AI agents", "Next.js"],
  authors: [{ name: "Artech" }],
  openGraph: {
    title: "ARTECH · Multi-Agent Orchestrator",
    description: "Pusat kendali multi-agent dengan visualisasi tata surya.",
    siteName: "ARTECH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARTECH · Multi-Agent Orchestrator",
    description: "Pusat kendali multi-agent dengan visualisasi tata surya.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "#05060d", color: "#eae8f5" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

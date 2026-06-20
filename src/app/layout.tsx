import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: env.APP_NAME,
    template: `%s · ${env.APP_NAME}`,
  },
  description: `${env.COMPANY_NAME} operations, inventory, and crew scheduling.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f1e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${newsreader.variable}`}
    >
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main-content">
          Skip to schedule
        </a>
        {children}
      </body>
    </html>
  );
}

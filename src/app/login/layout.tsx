import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "MK Akur8 — Admin",
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh w-full carbon-bg">{children}</div>;
}

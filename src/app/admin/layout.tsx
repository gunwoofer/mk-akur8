import type { Metadata, Viewport } from "next";
import PortraitLock from "@/components/admin/PortraitLock";

export const metadata: Metadata = {
  title: "MK Akur8 — Admin",
  description: "Mobile admin portal for submitting race results.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full carbon-bg overflow-x-hidden">
      <PortraitLock />
      {children}
    </div>
  );
}

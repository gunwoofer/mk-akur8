import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MK Akur8 — Admin",
  description: "Mobile admin portal for submitting race results.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full carbon-bg overflow-x-hidden">
      {/* Portrait orientation lock hint for mobile */}
      <style>{`
        @media (orientation: landscape) and (max-width: 768px) {
          .portrait-lock-overlay { display: flex; }
        }
      `}</style>
      {/* Landscape blocker on true mobile */}
      <div
        className="portrait-lock-overlay hidden fixed inset-0 z-[9999] bg-[#121212] flex-col items-center justify-center gap-4 text-center px-8"
      >
        <span className="text-5xl">📱</span>
        <p className="text-white text-lg font-bold">Please rotate your device</p>
        <p className="text-gray-400 text-sm">This app requires portrait orientation.</p>
      </div>
      {children}
    </div>
  );
}

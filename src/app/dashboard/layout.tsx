import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MK Akur8 — Live Leaderboard",
  description: "Always-on kiosk display showing live Mario Kart office rankings.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full min-h-screen overflow-hidden"
      style={{
        backgroundImage: "url('/mario-kart-world-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay — stronger at bottom to anchor the leaderboard */}
      <div className="w-full min-h-screen" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.82) 100%)" }}>
        {children}
      </div>
    </div>
  );
}

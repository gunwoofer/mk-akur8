import Leaderboard from "@/components/dashboard/Leaderboard";

// Always render fresh; this page subscribes to realtime and reads env vars at runtime
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <Leaderboard />;
}

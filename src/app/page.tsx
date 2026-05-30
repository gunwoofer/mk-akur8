"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const target = window.innerWidth < 768 ? "/admin" : "/dashboard";
    router.replace(target);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#00d4ff] text-sm tracking-widest uppercase">Loading</p>
      </div>
    </div>
  );
}

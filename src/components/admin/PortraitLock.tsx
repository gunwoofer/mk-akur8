"use client";

import { useEffect, useState } from "react";

// CSS `orientation` compares viewport width/height, so the on-screen keyboard
// shrinking the viewport reads as "landscape". Use the device orientation instead.
function isPhoneInLandscape() {
  const shortSide = Math.min(screen.width, screen.height);
  if (shortSide >= 768) return false;
  const type = screen.orientation?.type;
  if (type) return type.startsWith("landscape");
  return screen.width > screen.height;
}

export default function PortraitLock() {
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const update = () => setLandscape(isPhoneInLandscape());
    update();
    screen.orientation?.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    return () => {
      screen.orientation?.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!landscape) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#121212] flex flex-col items-center justify-center gap-4 text-center px-8">
      <span className="text-5xl">📱</span>
      <p className="text-white text-lg font-bold">Please rotate your device</p>
      <p className="text-gray-400 text-sm">This app requires portrait orientation.</p>
    </div>
  );
}

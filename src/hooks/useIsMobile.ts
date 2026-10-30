"use client";

import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

// Phones only — iPad (768px+) and computers keep the TV layout.
// Done in JS rather than Tailwind's md: variants, which compile to media-query
// range syntax that the TV's iOS 12 iPad ignores (it would get the mobile layout).
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    // addListener: Safari < 14 has no addEventListener on MediaQueryList
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  return isMobile;
}

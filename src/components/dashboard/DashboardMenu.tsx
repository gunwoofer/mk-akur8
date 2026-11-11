"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface MenuItem {
  icon: string;
  label: string;
  hint: string;
  onSelect: () => void;
}

// One button instead of a row of them; each entry says what it opens.
export default function DashboardMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center px-3.5 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
          open ? "border-[#ffd400]/60 bg-black/80 text-[#ffd400]" : "border-white/15 bg-black/50 text-[#e5e7eb]"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span className="text-sm leading-none mr-2">☰</span>Menu
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-72 rounded-xl border border-white/10 overflow-hidden"
              style={{ top: "calc(100% + 6px)", right: 0, background: "#15151c", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}
            >
              {items.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => { setOpen(false); item.onSelect(); }}
                  className={`w-full flex items-center px-4 py-3 text-left active:bg-white/10 hover:bg-white/5 ${i > 0 ? "border-t border-white/5" : ""}`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span className="text-xl w-8 shrink-0">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-white text-sm font-semibold">{item.label}</span>
                    <span className="block text-[#9ca3af] text-xs truncate">{item.hint}</span>
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  const onScroll = useCallback(() => {
    setVisible(window.scrollY > window.innerHeight);
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Volver arriba"
      className="fixed bottom-6 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200/90 bg-white/95 text-zinc-800 shadow-[0_8px_30px_-6px_rgba(24,24,27,0.35)] backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:bottom-8 sm:right-8"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M12 19V5" />
        <path d="m6 11 6-6 6 6" />
      </svg>
    </button>
  );
}

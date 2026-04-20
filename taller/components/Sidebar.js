"use client";

import { useEffect, useMemo, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export default function Sidebar({ anchor = "left", width = "320px", children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleToggleSidebar = (event) => {
      if (!event.detail) return;

      if (event.detail.toggle === true) {
        setIsOpen((prev) => !prev);
        return;
      }

      if (typeof event.detail.isOpen === "boolean") {
        setIsOpen(event.detail.isOpen);
      }
    };

    window.addEventListener("toggleSidebar", handleToggleSidebar);
    return () => window.removeEventListener("toggleSidebar", handleToggleSidebar);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const dynamicWidth = isMobile ? "min(85vw, 320px)" : width;

  const panelStyles = useMemo(() => {
    const common = {
      position: "fixed",
      zIndex: 1300,
      transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
      background: "#ffffff",
      color: "#0f172a",
      boxShadow: "0 20px 48px rgba(15, 23, 42, 0.18)",
      borderRight: "1px solid rgba(226, 232, 240, 1)",
    };

    if (anchor === "right") {
      return {
        ...common,
        top: 0,
        right: 0,
        width: dynamicWidth,
        height: "100dvh",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
      };
    }

    if (anchor === "top") {
      return {
        ...common,
        top: 0,
        left: 0,
        width: "100%",
        height: dynamicWidth,
        transform: isOpen ? "translateY(0)" : "translateY(-100%)",
      };
    }

    if (anchor === "bottom") {
      return {
        ...common,
        bottom: 0,
        left: 0,
        width: "100%",
        height: dynamicWidth,
        transform: isOpen ? "translateY(0)" : "translateY(100%)",
      };
    }

    return {
      ...common,
      top: 0,
      left: 0,
      width: dynamicWidth,
      height: "100dvh",
      transform: isOpen ? "translateX(0)" : "translateX(-100%)",
    };
  }, [anchor, dynamicWidth, isOpen]);

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[1200] bg-slate-900/35 backdrop-blur-[2px]"
        />
      ) : null}

      <aside style={panelStyles} aria-hidden={!isOpen}>
        {children}
      </aside>
    </>
  );
}

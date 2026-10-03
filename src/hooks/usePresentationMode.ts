import { useEffect, useState } from "react";

export type PresentationMode = "mobile" | "tablet" | "desktop";
export type PresentationOrientation = "portrait" | "landscape";

/**
 * Presentation mode drives the three dedicated editor compositions
 * (Mobile / Tablet / Desktop) over one shared state + engine.
 *
 * Mobile   < 768px   — app-like single-column editor.
 * Tablet   768–1199  — hybrid (portrait stacked, landscape rail).
 * Desktop  >= 1200px — approved full 3-column editor.
 *
 * State (strokes, character, tools, variants, saved flags) lives in the
 * component and is untouched by mode switches — only the JSX branches
 * change, so resizing never loses handwriting.
 */
const modeForWidth = (w: number): PresentationMode =>
  w >= 1200 ? "desktop" : w >= 768 ? "tablet" : "mobile";

const orientationFor = (w: number, h: number): PresentationOrientation =>
  h >= w ? "portrait" : "landscape";

export const usePresentationMode = (): {
  mode: PresentationMode;
  orientation: PresentationOrientation;
} => {
  const [mode, setMode] = useState<PresentationMode>(() =>
    typeof window === "undefined" ? "desktop" : modeForWidth(window.innerWidth),
  );
  const [orientation, setOrientation] = useState<PresentationOrientation>(() =>
    typeof window === "undefined" || window.innerHeight >= window.innerWidth
      ? "portrait"
      : "landscape",
  );

  useEffect(() => {
    const onChange = () => {
      setMode(modeForWidth(window.innerWidth));
      setOrientation(orientationFor(window.innerWidth, window.innerHeight));
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return { mode, orientation };
};

import { useRef, useEffect } from "react";

/**
 * Hook to prevent iOS Safari zoom on input focus
 * Temporarily sets font-size to 16px on focus for the input text only,
 * while keeping placeholder small via separate CSS targeting
 * This prevents zoom while allowing the input to maintain a smaller visual size when not focused
 */
export function usePreventZoom<
  T extends HTMLInputElement | HTMLTextAreaElement,
>() {
  const ref = useRef<T>(null);
  const originalFontSize = useRef<string | null>(null);
  const styleIdRef = useRef<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Generate unique ID for this element's style
    if (!element.id) {
      element.id = `prevent-zoom-${Math.random().toString(36).substr(2, 9)}`;
    }
    const elementId = element.id;
    styleIdRef.current = `prevent-zoom-style-${elementId}`;

    const handleFocus = () => {
      // Store original font-size if not already stored
      if (originalFontSize.current === null) {
        const computedStyle = window.getComputedStyle(element);
        originalFontSize.current = computedStyle.fontSize;
      }

      // Set to 16px to prevent zoom (iOS Safari threshold)
      element.style.fontSize = "16px";

      // Inject style to keep placeholder small
      if (!document.getElementById(styleIdRef.current!)) {
        const style = document.createElement("style");
        style.id = styleIdRef.current!;
        style.textContent = `
          #${elementId}::placeholder {
            font-size: 12px !important;
          }
        `;
        document.head.appendChild(style);
      }
    };

    const handleBlur = () => {
      // Restore original font-size
      if (originalFontSize.current !== null) {
        element.style.fontSize = originalFontSize.current;
      }

      // Remove the injected style
      const styleEl = document.getElementById(styleIdRef.current!);
      if (styleEl) {
        styleEl.remove();
      }
    };

    element.addEventListener("focus", handleFocus);
    element.addEventListener("blur", handleBlur);

    return () => {
      element.removeEventListener("focus", handleFocus);
      element.removeEventListener("blur", handleBlur);
      // Clean up style on unmount
      const styleEl = document.getElementById(styleIdRef.current!);
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  return ref;
}

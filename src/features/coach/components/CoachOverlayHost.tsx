import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useCoach } from "@/features/coach/context/coachContext";
import { overlaySnapshot, registerOverlay, subscribeOverlays, topOverlay, trapFocus } from "@/components/overlays/overlayLayers";
import { CoachWorkspace } from "./CoachWorkspace";
export function CoachOverlayHost() {
  const coach = useCoach(); const layers = useSyncExternalStore(subscribeOverlays, overlaySnapshot, overlaySnapshot);
  const scrollPosition = useRef(0);
  if (!coach?.userID || !coach.isOpen) return null;
  const owner = [...layers].reverse().find(layer => layer.kind === "workout" && layer.root.isConnected);
  const target = owner?.root.querySelector<HTMLElement>("[data-coach-outlet]") || document.body;
  return createPortal(<CoachDrawer scrollPosition={scrollPosition} />, target);
}
function CoachDrawer({ scrollPosition }: { scrollPosition: React.MutableRefObject<number> }) {
  const coach = useCoach()!; const root = useRef<HTMLElement>(null); const callbacks = useRef(coach); callbacks.current = coach;
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  useEffect(() => { const query = window.matchMedia("(max-width: 1023px)"); const update = () => setMobile(query.matches); query.addEventListener("change", update); update(); return () => query.removeEventListener("change", update); }, []);
  useLayoutEffect(() => {
    const element = root.current; if (!element) return;
    const id = Symbol("coach"); const unregister = registerOverlay({ id, root: element, kind: "coach", modal: mobile });
    function viewport() {
      if (!mobile) return;
      const height = window.visualViewport?.height || window.innerHeight;
      element!.style.height = `${height}px`;
      element!.style.setProperty("--coach-viewport-height", `${height}px`);
      element!.classList.toggle("coach-keyboard-open", height < 600);
    }
    viewport();window.visualViewport?.addEventListener("resize",viewport);
    if (callbacks.current.claimFocus()) element.querySelector<HTMLElement>("[data-coach-close]")?.focus({ preventScroll: true });
    function keydown(event: KeyboardEvent) {
      if (topOverlay()?.id !== id) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.closeCoach(); }
      else if (mobile && event.key === "Tab") { trapFocus(event, element!); event.stopImmediatePropagation(); }
    }
    window.addEventListener("keydown", keydown);
    return () => { unregister(); window.removeEventListener("keydown", keydown); window.visualViewport?.removeEventListener("resize",viewport);element.style.height=""; element.style.removeProperty("--coach-viewport-height"); element.classList.remove("coach-keyboard-open"); };
  }, [mobile]);
  return <div className={`coach-overlay${mobile ? " coach-overlay-modal" : ""}`} onMouseDown={event => { if (mobile && event.target === event.currentTarget) coach.closeCoach(); }}>
    <section ref={root} id="ai-coach-panel" className="coach-drawer" role="dialog" aria-modal={mobile ? "true" : "false"} aria-labelledby="ai-coach-title" tabIndex={-1}>
      <header className="coach-drawer-header"><div><Sparkles size={20} aria-hidden="true" /><h2 id="ai-coach-title">AI Coach</h2><span>Training support</span></div><button data-coach-close type="button" className="icon-button" aria-label="Close Coach" onClick={coach.closeCoach}><X size={20} aria-hidden="true" /></button></header>
      <CoachWorkspace scrollPosition={scrollPosition} />
    </section>
  </div>;
}

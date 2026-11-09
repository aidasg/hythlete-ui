export type OverlayLayer = { id: symbol; root: HTMLElement; kind: "workout" | "coach"; modal: boolean };
let layers: OverlayLayer[] = [];
const listeners = new Set<() => void>();
let scrollLocks = 0;
let originalOverflow = "";
export function registerOverlay(layer: OverlayLayer) {
  if (layer.modal) { if (!scrollLocks) { originalOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; } scrollLocks++; }
  layers = [...layers, layer]; listeners.forEach(listener => listener());
  return () => {
    layers = layers.filter(item => item.id !== layer.id);
    if (layer.modal && --scrollLocks === 0) document.body.style.overflow = originalOverflow;
    listeners.forEach(listener => listener());
  };
}
export const overlaySnapshot = () => layers;
export const subscribeOverlays = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const topOverlay = () => layers[layers.length - 1];
export function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])")).filter(element => {
    if (element.closest("[hidden], [inert]") || element.matches(":disabled")) return false;
    for (let ancestor: Element | null = element; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
      const style = window.getComputedStyle(ancestor);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open && !ancestor.querySelector(":scope > summary")?.contains(element)) return false;
    }
    return true;
  });
}
export function trapFocus(event: KeyboardEvent, root: HTMLElement) {
  const items = focusableElements(root), first = items[0], last = items[items.length - 1];
  if (!first || !last) { event.preventDefault(); root.focus(); }
  else if (!root.contains(document.activeElement) || !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
}

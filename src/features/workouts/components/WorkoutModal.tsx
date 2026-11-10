import { focusableElements, registerOverlay, topOverlay, trapFocus } from "@/components/overlays/overlayLayers";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type WorkoutModalProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "modal" | "drawer";
  size?: "default" | "compact";
  dismissDisabled?: boolean;
};

function getModalTitleId(title: string) {
  return `workout-modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function WorkoutModal({
  title,
  eyebrow,
  children,
  onClose,
  variant = "modal",
  size = "default",
  dismissDisabled = false,
}: WorkoutModalProps) {
  const titleId = getModalTitleId(title);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissDisabledRef = useRef(dismissDisabled);
  dismissDisabledRef.current = dismissDisabled;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  function closeSafely() {
    if (dismissDisabledRef.current) return;
    if (dialogRef.current?.querySelector('[data-builder-dirty="true"]') && !window.confirm("Discard your unsaved workout changes?")) return;
    onCloseRef.current();
  }

  useLayoutEffect(() => {
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root=dialogRef.current;if(!root)return;
    const id=Symbol("workout");const unregister=registerOverlay({id,root,kind:"workout",modal:true});

    focusableElements(root)[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      const top=topOverlay();if(!top||!dialogRef.current)return;
      if(event.key==="Escape"){if(top.id!==id)return;event.preventDefault();closeSafely();return;}
      if(event.key!=="Tab")return;
      if(top.id!==id && !(top.kind==="coach"&&!top.modal&&dialogRef.current.contains(top.root)))return;
      trapFocus(event,dialogRef.current);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unregister();
      previouslyFocusedElement?.focus();
    };
  }, []);

  return createPortal(
    <div
      className={`workout-modal-backdrop${variant === "drawer" ? " workout-drawer-backdrop" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeSafely();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={`workout-modal${variant === "drawer" ? " workout-drawer" : ""}${size === "compact" ? " workout-modal-compact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="workout-modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close modal"
            disabled={dismissDisabled}
            onClick={closeSafely}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
        <div data-coach-outlet />
      </section>
    </div>,
    document.body,
  );
}

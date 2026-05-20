import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type WorkoutModalProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
};

function getModalTitleId(title: string) {
  return `workout-modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function WorkoutModal({
  title,
  eyebrow,
  children,
  onClose,
}: WorkoutModalProps) {
  const titleId = getModalTitleId(title);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="workout-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="workout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

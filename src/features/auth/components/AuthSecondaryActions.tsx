import { Compass, SlidersHorizontal } from "lucide-react";

export function AuthSecondaryActions() {
  return (
    <div className="auth-actions">
      <button className="secondary-button" type="button">
        <SlidersHorizontal size={18} aria-hidden="true" />
        Set today's constraints
      </button>
      <button className="secondary-button" type="button">
        <Compass size={18} aria-hidden="true" />
        Map long-term direction
      </button>
    </div>
  );
}

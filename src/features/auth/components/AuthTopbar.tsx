import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { marketingLinks } from "@/services/navigation";

export function AuthTopbar() {
  return (
    <nav className="topbar" aria-label="Primary">
      <BrandLockup />
      <Link className="ghost-button" to={marketingLinks.beta}>
        <Sparkles size={17} aria-hidden="true" />
        Start planning
      </Link>
    </nav>
  );
}

import { Link } from "react-router-dom";
import { Orbit } from "lucide-react";
import { paths } from "@/routes/paths";

export function BrandLockup() {
  return (
    <Link className="brand-lockup" to={paths.login} aria-label="Hythlete home">
      <span className="brand-mark">
        <Orbit size={24} aria-hidden="true" />
      </span>
      <span>Hythlete</span>
    </Link>
  );
}

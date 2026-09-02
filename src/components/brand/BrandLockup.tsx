import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { paths } from "@/routes/paths";

type BrandLockupProps = {
  to?: string;
};

export function BrandLockup({ to = paths.login }: BrandLockupProps) {
  return (
    <Link className="brand-lockup" to={to} aria-label="Hythlete home">
      <span className="brand-mark">
        <Activity size={21} aria-hidden="true" />
      </span>
      <span>Hythlete</span>
    </Link>
  );
}

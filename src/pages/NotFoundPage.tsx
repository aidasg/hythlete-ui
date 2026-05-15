import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";

export function NotFoundPage() {
  return (
    <main className="app-shell centered-page">
      <section className="empty-state" aria-labelledby="not-found-title">
        <p className="eyebrow">Signal lost</p>
        <h1 id="not-found-title">This route is outside the training zone.</h1>
        <Link className="primary-button" to={paths.login}>
          Back to login
        </Link>
      </section>
    </main>
  );
}

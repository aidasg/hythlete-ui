import { Activity } from "lucide-react";
import { loginHeroContent } from "@/features/auth/services/authMockData";

export function LoginHero() {
  return (
    <>
      <div className="hero-copy">
        <p className="eyebrow">{loginHeroContent.eyebrow}</p>
        <h1>{loginHeroContent.headline}</h1>
        <p className="hero-text">{loginHeroContent.body}</p>
      </div>

      <div className="visual-system" aria-hidden="true">
        <div className="orbit-ring orbit-ring-one" />
        <div className="orbit-ring orbit-ring-two" />
        <div className="core-pulse">
          <Activity size={42} />
        </div>
        <div className="trajectory trajectory-one" />
        <div className="trajectory trajectory-two" />
      </div>
    </>
  );
}

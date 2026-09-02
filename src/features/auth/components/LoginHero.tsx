import { loginHeroContent } from "@/features/auth/services/authMockData";

export function LoginHero() {
  return (
    <div className="hero-copy">
      <p className="eyebrow">{loginHeroContent.eyebrow}</p>
      <h1>{loginHeroContent.headline}</h1>
      <p className="hero-text">{loginHeroContent.body}</p>
    </div>
  );
}

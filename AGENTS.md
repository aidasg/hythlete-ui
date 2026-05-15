# AGENTS.md

Guidance for AI agents working in this repository.

## Project Shape

- This is a Vite, React, and TypeScript UI project.
- Keep `src/App.tsx` focused on routing only. Do not put page markup, forms, API calls, or large UI composition directly in `App`.
- Keep `src/main.tsx` responsible for React bootstrapping and top-level providers such as `BrowserRouter`.
- User-facing pages live in `src/pages`.
- Feature-specific UI, services, and types live under `src/features/<feature>/`.
- Reusable cross-feature UI lives under `src/components`.
- Shared route constants live in `src/routes/paths.ts`.
- Shared app services and infrastructure live under `src/services`.

## Routing

- Add routes in `src/App.tsx` using `react-router-dom`.
- Use route constants from `src/routes/paths.ts` when linking from components.
- The root route currently redirects to `/login`.
- Wrap guest-only routes with `GuestRoute` and protected routes with `ProtectedRoute`.
- Private pages should not duplicate profile/session validation; rely on `AuthProvider` and `ProtectedRoute`.
- Keep page components thin: pages should compose feature components rather than implement detailed forms or panels inline.

## Component Practices

- Prefer named, reusable components over inline mockup blocks.
- Split UI by responsibility. For example, auth uses:
  - `AuthBrandPanel`
  - `AuthTopbar`
  - `LoginHero`
  - `TrainingMetricsStrip`
  - `MetricCard`
  - `LoginPanel`
  - `AuthForm`
  - `AuthSecondaryActions`
- Keep mock/static display data outside components when it may be reused or replaced later. Auth mock content lives in `src/features/auth/services/authMockData.ts`.
- Keep feature types in a local `types.ts` when they are not generated from the API.
- Use `Link` from `react-router-dom` for internal navigation.
- If a UI state switch should not navigate, use local component state instead of adding routes. Login/register mode switching is the current example.

## Auth UI Pattern

- The login and register flows share one page and one form component.
- Clicking register must switch the form into registration mode in place. It must not redirect to a separate registration route unless the product requirements change.
- Login mode submits to `login()` from `src/features/auth/services/authApi.ts`.
- Register mode submits to `register()` from `src/features/auth/services/authApi.ts`.
- Successful login or registration should save the auth response with `saveAuthSession()` and redirect to `/dashboard`.
- Login and dashboard session validation should use `validateAuthSession()` from `src/features/auth/services/authSession.ts`.
- App-wide auth state should live in `AuthProvider` from `src/features/auth/context/AuthContext.tsx`.
- Components that need the current session should use `useAuth()` from `src/features/auth/context/useAuth.ts`.
- `validateAuthSession()` should call `getProfile()` from `src/features/profile/services/profileApi.ts`.
- If profile validation fails, clear the stored auth session and redirect back to `/login`.
- Dashboard top-bar controls belong in `src/features/dashboard/components/DashboardTopbar.tsx`.
- Logout should call `logout()` from `src/features/auth/services/authApi.ts`, then clear the stored auth session and route to `/login`.
- Registration mode includes `username`, `email`, and `password`.
- Login mode includes `email` and `password`.
- Auth submit handlers should show inline success and error states.
- Prevent default form submission and call the typed service functions.
- Keep cookie-based auth same-origin in local dev by using the default `/api` client base URL.

## API Integration

- The backend OpenAPI 3.1 spec is expected at `../hythlete-be/docs/openapiv3.json`.
- Generate API types with:

```bash
npm run generate:api
```

- `generate-api.sh` wraps `openapi-typescript`.
- The generated schema lives at `src/services/api/generated/schema.ts`.
- Do not manually edit files under `src/services/api/generated`.
- Use `openapi-typescript` for generated TypeScript types.
- Use `openapi-fetch` for the typed runtime client.
- The shared typed client lives at `src/services/api/client.ts`.
- Re-export generated API types through `src/services/api/types.ts`.
- Add feature-specific API wrapper functions near the feature that consumes them:
  - auth API wrappers in `src/features/auth/services/authApi.ts`
  - profile API wrappers in `src/features/profile/services/profileApi.ts`
  - cross-cutting/system API wrappers in `src/services/api`
- UI components should call feature-level service wrappers, not raw generated schema paths directly.

## API Configuration

- Browser API calls default to `/api` via `src/services/api/config.ts`.
- Vite proxies `/api` to `HYTHLETE_API_HOSTNAME` or `http://localhost:18086` in development.
- Use `VITE_HYTHLETE_API_BASE_URL` only when intentionally bypassing the same-origin `/api` proxy.
- Keep `credentials: "include"` enabled on the OpenAPI fetch client so cookie sessions work.

## Styling

- Global styling currently lives in `src/index.css`.
- Preserve the dark, high-tech athletic visual direction: dark navy base, electric cyan accents, and restrained violet-blue glow.
- Avoid green/lime accents in the primary UI palette unless the user explicitly asks for them.
- Use stable dimensions for buttons, panels, metric cards, and form controls to avoid layout shift.
- Keep cards and panels at `8px` radius unless the design system changes.
- Do not put app behavior instructions as visible text in the UI.
- Use lucide icons where an icon is appropriate.

## Scripts

- `npm run dev` starts Vite.
- `npm run build` type-checks and builds production assets.
- `npm run lint` runs ESLint.
- `npm run preview` serves the built app.
- `npm run generate:api` regenerates OpenAPI TypeScript types.

## Verification

- After changing TypeScript, React components, routing, services, or generated API wiring, run:

```bash
npm run lint
npm run build
```

- After changing OpenAPI generation config or backend spec assumptions, also run:

```bash
npm run generate:api
```

- If dependency installation or dev server startup is blocked by sandbox/network permissions, state that clearly and continue with verifiable checks where possible.

## Dependency Choices

- Prefer small, focused packages.
- For OpenAPI, use the established `openapi-typescript` plus `openapi-fetch` pattern rather than heavier client code generators.
- Do not introduce a new state management, data fetching, or UI framework unless a concrete feature requires it.

## Editing Rules

- Keep generated files separate from handwritten code.
- Do not manually patch `package-lock.json` unless absolutely necessary; let npm update it.
- Do not commit or rely on `dist`, `node_modules`, or `*.tsbuildinfo`.
- Keep new files and code ASCII unless the existing file clearly uses Unicode.
- Add comments only where they clarify non-obvious behavior.

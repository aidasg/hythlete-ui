# Hythlete UI

React, TypeScript, and Vite backbone for the Hythlete athlete app.

## Scripts

- `npm run dev` starts Vite on host `::` and port `80`.
- `npm run generate:api` regenerates TypeScript API types from the backend OpenAPI spec.
- `npm run build` type-checks and builds production assets.
- `npm run lint` runs ESLint.
- `npm run preview` serves the built app locally.

The dev server mirrors the `love-n-spice` host setup with `/api` proxied to
`HYTHLETE_API_HOSTNAME` or `http://localhost:18086` in development.
The browser API client calls `/api` by default so session cookies stay
same-origin during local development. Set `VITE_HYTHLETE_API_BASE_URL` only when
you intentionally want the client to call a direct API origin.

## API Generation

The generated OpenAPI schema lives at `src/services/api/generated/schema.ts`.
It is produced from `../hythlete-be/docs/openapiv3.json` with
`openapi-typescript`.

Override the paths when needed:

```bash
OPENAPI_SPEC_PATH=../hythlete-be/docs/openapiv3.json \
OPENAPI_OUTPUT_PATH=src/services/api/generated/schema.ts \
npm run generate:api
```

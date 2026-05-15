/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HYTHLETE_API_HOSTNAME?: string;
  readonly VITE_HYTHLETE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

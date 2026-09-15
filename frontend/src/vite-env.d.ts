/// <reference types="vite/client" />

declare module '@phosphor-icons/web/regular';
declare module '@phosphor-icons/web/fill';

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

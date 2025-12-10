// The following reference is commented out to resolve the "Cannot find type definition file" error.
// /// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

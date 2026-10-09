/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_ENV: 'local' | 'development' | 'staging' | 'production';
  readonly VITE_FARO_ENABLED?: string;
  readonly VITE_FARO_URL?: string;
  readonly VITE_FARO_API_KEY?: string;
  readonly VITE_FARO_APP_NAME?: string;
  readonly VITE_FARO_APP_VERSION?: string;
  readonly VITE_FARO_REPLAY_ENABLED?: string;
  readonly VITE_FARO_REPLAY_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

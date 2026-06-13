/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AD_GROUP_ID_INTERSTITIAL?: string;
  readonly VITE_AD_GROUP_ID_REWARDED?: string;
  readonly VITE_AD_GROUP_ID_BANNER?: string;
  readonly VITE_AITS_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

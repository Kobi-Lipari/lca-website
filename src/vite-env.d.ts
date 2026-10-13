interface ImportMetaEnv {
  /** The build's mode, set by vite: "production", "development", or "a11y" for the accessibility test build. */
  readonly MODE: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_FORMSPREE_FORM_ID?: string
  /** Optional: labels the email preview. See functions/utils/site.ts. */
  readonly VITE_SITE_URL?: string
  /**
   * Switch names to turn on, comma-separated. Read only by the accessibility
   * test build (vite build --mode a11y); see src/lib/features.ts.
   */
  readonly VITE_FLAGS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.svg' {
  import type React from 'react'
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

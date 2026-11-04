import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import { startColorScheme } from '@/hooks/useColorScheme'
import { FEATURES } from '@/lib/features'
import { reloadOnStaleChunk } from '@/lib/reloadOnStaleChunk'
import App from './App.tsx'
import './index.css'

// A tab left open across a deploy asks for page files the new build no
// longer serves; reload such a tab once, so it picks up the new build. No
// switch governs it: what a visitor sees changes only when a file fails to
// load, as src/lib/reloadOnStaleChunk.ts sets out.
reloadOnStaleChunk()

// The new look's tokens apply only under data-look="new" (src/index.css).
// The head script vite.config.ts adds sets it before the first paint as
// well; setting it here too keeps the page right if that script did not run.
if (FEATURES.newLook) {
  document.documentElement.setAttribute('data-look', 'new')
  startColorScheme()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
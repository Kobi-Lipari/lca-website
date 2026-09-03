// src/components/auth/PasswordRecoveryRedirect.tsx
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '@/lib/supabase'

/**
 * Sends someone arriving on a password-recovery link to the page that can
 * actually reset it.
 *
 * Supabase only redirects to the `redirectTo` we asked for if that exact URL
 * is on the project's allowed Redirect URLs list. When it is not, it falls
 * back to the project's Site URL — which drops the member on the site root
 * holding a valid recovery token and no way to use it. That is exactly what
 * was happening: the reset email opened the home page and nothing else.
 *
 * The Supabase settings are the real fix. This is the safety net, so a
 * misconfigured redirect degrades into "you end up on the right page" rather
 * than "the feature silently does nothing".
 */
export function PasswordRecoveryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY') return
      if (location.pathname === '/reset-password') return
      navigate('/reset-password', { replace: true })
    })

    return () => subscription.unsubscribe()
  }, [navigate, location.pathname])

  return null
}

import { useEffect } from 'react'

const SITE_NAME = 'Louisiana Chess Association'

export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    return () => {
      document.title = previous
    }
  }, [title])
}

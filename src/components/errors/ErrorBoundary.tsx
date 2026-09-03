import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center"
          role="alert"
        >
          <h1 className="text-2xl font-bold text-lca-navy">
            Something went wrong
          </h1>
          <p className="mt-2 text-muted-foreground">
            An unexpected error occurred. Please refresh the page or return
            home.
          </p>
          <div className="mt-6 flex gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Go home</Link>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

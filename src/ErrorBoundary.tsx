import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SWOOP render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            background: '#1a1a2e',
            color: '#fecaca',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ color: 'white', marginTop: 0 }}>Something went wrong</h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: 'rgba(0,0,0,0.3)',
              padding: 16,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ color: '#94a3b8' }}>
            Common fix: re-paste <code>src/GameTable.tsx</code> from your local project
            (look for <code>const faceUpKey</code> and no <code>return null</code>).
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

import './App.css'
import { ErrorBoundary } from './ErrorBoundary'
import { LayoutProvider } from './LayoutContext'
import GameTable from './GameTable'

export default function App() {
  return (
    <ErrorBoundary>
      <LayoutProvider>
        <GameTable />
      </LayoutProvider>
    </ErrorBoundary>
  )
}
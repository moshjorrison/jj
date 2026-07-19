import './App.css'
import { ErrorBoundary } from './ErrorBoundary'
import GameTable from './GameTable'

export default function App() {
  return (
    <ErrorBoundary>
      <GameTable />
    </ErrorBoundary>
  )
}
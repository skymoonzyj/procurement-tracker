import { AppProvider } from './state/AppProvider'
import { AppShell } from './components/layout/AppShell'
export function App() { return <AppProvider><AppShell /></AppProvider> }

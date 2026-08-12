import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react'
import { invoiceRepo, persistSnapshot, purchaseRepo } from '../storage/db'
import { appReducer, initialAppState, type AppAction, type AppState } from './appReducer'

interface AppContextValue {
  state: AppState
  dispatch: (action: AppAction) => void
  refresh: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: PropsWithChildren) {
  const [state, baseDispatch] = useReducer(appReducer, initialAppState)
  const stateRef = useRef(state)
  const hydratedRef = useRef(false)
  stateRef.current = state

  const refresh = useCallback(async () => {
    try {
      const [purchases, invoices] = await Promise.all([purchaseRepo.list(), invoiceRepo.list()])
      hydratedRef.current = true
      baseDispatch({ type: 'setHydrated', purchases, invoices })
    } catch (error: unknown) {
      if (!hydratedRef.current) {
        hydratedRef.current = true
        baseDispatch({ type: 'setHydrated', purchases: stateRef.current.purchases, invoices: stateRef.current.invoices })
      }
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dispatch = useCallback((action: AppAction) => {
    const next = appReducer(stateRef.current, action)
    stateRef.current = next
    baseDispatch(action)
    if (action.type === 'setHydrated' || action.type === 'setPersistenceError') return
    persistSnapshot(next).catch((error: unknown) => {
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
    })
  }, [])

  const value = useMemo(() => ({ state, dispatch, refresh }), [state, dispatch, refresh])
  return <AppContext.Provider value={value}>
    {state.loading && <div className="loading-bar" role="status">加载中…</div>}
    {children}
  </AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

export type { AppContextValue }

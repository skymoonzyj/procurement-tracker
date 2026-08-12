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
  const queuedActionsRef = useRef<AppAction[]>([])
  stateRef.current = state

  const refresh = useCallback(async () => {
    try {
      const [purchases, invoices] = await Promise.all([purchaseRepo.list(), invoiceRepo.list()])
      const hydrated = appReducer(stateRef.current, { type: 'setHydrated', purchases, invoices })
      stateRef.current = hydrated
      hydratedRef.current = true
      baseDispatch({ type: 'setHydrated', purchases, invoices })
      const queuedActions = queuedActionsRef.current.splice(0)
      for (const queued of queuedActions) {
        const next = appReducer(stateRef.current, queued)
        stateRef.current = next
        baseDispatch(queued)
      }
      if (queuedActions.length) void persistSnapshot(stateRef.current)
    } catch (error: unknown) {
      if (!hydratedRef.current) {
        const hydrated = appReducer(stateRef.current, { type: 'setHydrated', purchases: stateRef.current.purchases, invoices: stateRef.current.invoices })
        stateRef.current = hydrated
        hydratedRef.current = true
        baseDispatch({ type: 'setHydrated', purchases: stateRef.current.purchases, invoices: stateRef.current.invoices })
        const queuedActions = queuedActionsRef.current.splice(0)
        for (const queued of queuedActions) {
          const next = appReducer(stateRef.current, queued)
          stateRef.current = next
          baseDispatch(queued)
        }
        if (queuedActions.length) void persistSnapshot(stateRef.current)
      }
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dispatch = useCallback((action: AppAction) => {
    if (!hydratedRef.current && !['setHydrated', 'setPersistenceError'].includes(action.type)) {
      queuedActionsRef.current.push(action)
      return
    }
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

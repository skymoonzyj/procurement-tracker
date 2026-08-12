import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react'
import { invoiceRepo, persistSnapshot, purchaseRepo } from '../storage/db'
import { appReducer, initialAppState, type AppAction, type AppState } from './appReducer'

interface AppContextValue {
  state: AppState
  dispatch: (action: AppAction) => Promise<boolean>
  refresh: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: PropsWithChildren) {
  const [state, baseDispatch] = useReducer(appReducer, initialAppState)
  const stateRef = useRef(state)
  const hydratedRef = useRef(false)
  const refreshGenerationRef = useRef(0)
  const queuedActionsRef = useRef<Array<{ action: AppAction; resolve: (ok: boolean) => void }>>([])
  stateRef.current = state

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current
    try {
      const [purchases, invoices] = await Promise.all([purchaseRepo.list(), invoiceRepo.list()])
      if (generation !== refreshGenerationRef.current) return
      const hydrated = appReducer(stateRef.current, { type: 'setHydrated', purchases, invoices })
      stateRef.current = hydrated
      hydratedRef.current = true
      baseDispatch({ type: 'setHydrated', purchases, invoices })
      const queuedActions = queuedActionsRef.current.splice(0)
      for (const { action: queued } of queuedActions) {
        const next = appReducer(stateRef.current, queued)
        stateRef.current = next
        baseDispatch(queued)
      }
      if (queuedActions.length) {
        persistSnapshot(stateRef.current).then(() => queuedActions.forEach(({ resolve }) => resolve(true))).catch((error: unknown) => {
          baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
          queuedActions.forEach(({ resolve }) => resolve(false))
        })
      }
    } catch (error: unknown) {
      if (generation !== refreshGenerationRef.current) return
      if (!hydratedRef.current) {
        const hydrated = appReducer(stateRef.current, { type: 'setHydrated', purchases: stateRef.current.purchases, invoices: stateRef.current.invoices })
        stateRef.current = hydrated
        hydratedRef.current = true
        baseDispatch({ type: 'setHydrated', purchases: stateRef.current.purchases, invoices: stateRef.current.invoices })
        const queuedActions = queuedActionsRef.current.splice(0)
        for (const { action: queued } of queuedActions) {
          const next = appReducer(stateRef.current, queued)
          stateRef.current = next
          baseDispatch(queued)
        }
        if (queuedActions.length) {
          persistSnapshot(stateRef.current).then(() => queuedActions.forEach(({ resolve }) => resolve(true))).catch((persistenceError: unknown) => {
            baseDispatch({ type: 'setPersistenceError', error: persistenceError instanceof Error ? persistenceError.message : String(persistenceError) })
            queuedActions.forEach(({ resolve }) => resolve(false))
          })
        }
      }
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dispatch = useCallback((action: AppAction): Promise<boolean> => {
    if (!hydratedRef.current && !['setHydrated', 'setPersistenceError'].includes(action.type)) {
      return new Promise(resolve => queuedActionsRef.current.push({ action, resolve }))
    }
    const next = appReducer(stateRef.current, action)
    stateRef.current = next
    baseDispatch(action)
    if (action.type === 'setHydrated' || action.type === 'setPersistenceError') return Promise.resolve(true)
    return persistSnapshot(next).then(() => true).catch((error: unknown) => {
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
      return false
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

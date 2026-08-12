import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react'
import { invoiceRepo, persistSnapshot, purchaseRepo } from '../storage/db'
import { appReducer, initialAppState, type AppAction, type AppState } from './appReducer'

interface AppContextValue {
  state: AppState
  dispatch: (action: AppAction) => Promise<boolean>
  refresh: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)
type Snapshot = Pick<AppState, 'purchases' | 'invoices'>

function snapshotOf(state: AppState): Snapshot {
  return { purchases: state.purchases, invoices: state.invoices }
}

export function AppProvider({ children }: PropsWithChildren) {
  const [state, baseDispatch] = useReducer(appReducer, initialAppState)
  const stateRef = useRef(state)
  const hydratedRef = useRef(false)
  const refreshGenerationRef = useRef(0)
  const mutationGenerationRef = useRef(0)
  const writeBarrierRef = useRef<Promise<void>>(Promise.resolve())
  const unsyncedSnapshotRef = useRef<Snapshot | undefined>(undefined)
  const queuedActionsRef = useRef<Array<{ action: AppAction; resolve: (ok: boolean) => void }>>([])
  stateRef.current = state

  const persistThroughBarrier = useCallback((snapshot: { purchases: AppState['purchases']; invoices: AppState['invoices'] }) => {
    const run = writeBarrierRef.current.then(() => persistSnapshot(snapshot))
    writeBarrierRef.current = run.catch(() => undefined)
    return run
  }, [])

  const waitForWrites = useCallback(async () => {
    while (true) {
      const barrier = writeBarrierRef.current
      await barrier
      if (barrier === writeBarrierRef.current) return
    }
  }, [])

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current
    await waitForWrites()
    const readMutationGeneration = hydratedRef.current ? mutationGenerationRef.current : undefined
    try {
      const [purchases, invoices] = await Promise.all([purchaseRepo.list(), invoiceRepo.list()])
      if (generation !== refreshGenerationRef.current) return
      // A read that started before a local mutation must never replace the
      // newer in-memory state with its stale snapshot.
      if (readMutationGeneration !== undefined && readMutationGeneration !== mutationGenerationRef.current) return

      // A replayed or locally-mutated snapshot can be newer than what the
      // repository returned (for example, when its first write failed). Keep
      // that dirty snapshot in memory and retry its write instead of replacing
      // it with the stale repository data.
      const unsyncedSnapshot = unsyncedSnapshotRef.current
      if (unsyncedSnapshot) {
        const unsyncedGeneration = mutationGenerationRef.current
        try {
          await persistThroughBarrier(unsyncedSnapshot)
          if (unsyncedGeneration === mutationGenerationRef.current && unsyncedSnapshotRef.current === unsyncedSnapshot) {
            unsyncedSnapshotRef.current = undefined
            baseDispatch({ type: 'setPersistenceError', error: undefined })
          }
        } catch (error: unknown) {
          if (generation === refreshGenerationRef.current) {
            baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
          }
        }
        hydratedRef.current = true
        return
      }

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
        const queuedGeneration = ++mutationGenerationRef.current
        const queuedSnapshot = snapshotOf(stateRef.current)
        unsyncedSnapshotRef.current = queuedSnapshot
        persistThroughBarrier(queuedSnapshot).then(() => {
          if (queuedGeneration === mutationGenerationRef.current && unsyncedSnapshotRef.current === queuedSnapshot) {
            unsyncedSnapshotRef.current = undefined
          }
          queuedActions.forEach(({ resolve }) => resolve(true))
        }).catch((error: unknown) => {
          // Hydration succeeded, so keep the replayed in-memory actions even
          // when their first persistence attempt fails; callers receive false
          // and can retry without losing the user's edits.
          baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
          queuedActions.forEach(({ resolve }) => resolve(false))
        })
      }
    } catch (error: unknown) {
      if (generation !== refreshGenerationRef.current) return
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
    }
  }, [persistThroughBarrier, waitForWrites])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dispatch = useCallback((action: AppAction): Promise<boolean> => {
    if (!hydratedRef.current && !['setHydrated', 'setPersistenceError'].includes(action.type)) {
      return new Promise(resolve => queuedActionsRef.current.push({ action, resolve }))
    }
    const next = appReducer(stateRef.current, action)
    const previous = stateRef.current
    const previousUnsyncedSnapshot = unsyncedSnapshotRef.current
    stateRef.current = next
    baseDispatch(action)
    if (action.type === 'setHydrated' || action.type === 'setPersistenceError') return Promise.resolve(true)
    const mutationGeneration = ++mutationGenerationRef.current
    const nextSnapshot = snapshotOf(next)
    unsyncedSnapshotRef.current = nextSnapshot
    return persistThroughBarrier(nextSnapshot).then(() => {
      if (mutationGeneration === mutationGenerationRef.current && unsyncedSnapshotRef.current === nextSnapshot) {
        unsyncedSnapshotRef.current = undefined
      }
      return true
    }).catch((error: unknown) => {
      // Roll back only when no newer mutation has superseded this write. A
      // later snapshot may already contain this action and must not be lost.
      if (mutationGenerationRef.current === mutationGeneration) {
        const restored = appReducer(stateRef.current, { type: 'replaceAll', purchases: previous.purchases, invoices: previous.invoices })
        stateRef.current = restored
        baseDispatch({ type: 'replaceAll', purchases: previous.purchases, invoices: previous.invoices })
        unsyncedSnapshotRef.current = previousUnsyncedSnapshot
      }
      baseDispatch({ type: 'setPersistenceError', error: error instanceof Error ? error.message : String(error) })
      return false
    })
  }, [persistThroughBarrier])

  const value = useMemo(() => ({ state, dispatch, refresh }), [state, dispatch, refresh])
  return <AppContext.Provider value={value}>
    {state.loading && <div className="loading-bar" role="status">加载中…</div>}
    {state.persistenceError && <div className="persistence-banner" role="alert">数据同步失败：{state.persistenceError}<button className="button secondary" onClick={() => void refresh()}>重试加载</button></div>}
    {children}
  </AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

export type { AppContextValue }

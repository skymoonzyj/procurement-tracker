import { useApp } from '../../state/AppProvider'
export function Toast() {
  const { state } = useApp()
  return state.persistenceError ? <div className="toast" role="alert">保存失败：{state.persistenceError}</div> : null
}

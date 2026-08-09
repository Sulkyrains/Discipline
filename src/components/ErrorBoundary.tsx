import { Component, type ErrorInfo, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Discipline render error:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="page page-error">
          <div className="card error-card">
            <span className="error-icon">⚠️</span>
            <h2>出错了</h2>
            <p className="muted">页面渲染遇到问题，请刷新重试。若持续出现，请通过“问题反馈”告诉我们。</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

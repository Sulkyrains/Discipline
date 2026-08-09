import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// jsdom does not implement scrollTo; make ScrollToTop harmless in tests.
window.scrollTo = () => {}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock
}

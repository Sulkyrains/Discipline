import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { useAppStore } from '../src/stores/useAppStore'

describe('app smoke', () => {
  beforeEach(() => {
    useAppStore.setState({
      settings: useAppStore.getState().settings,
      courses: [],
      todos: [],
      sessions: [],
      unlocked: [],
      feedback: [],
      mergedFor: null
    })
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders the home page with the day quote', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText(/Always believe a better day/)).toBeInTheDocument()
  })

  it('applies the active theme to the document root', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    act(() => {
      useAppStore.getState().setSettings({ theme: 'vibrant' })
    })
    expect(document.documentElement.dataset.theme).toBe('vibrant')
  })
})

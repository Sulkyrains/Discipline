import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Settings from '../src/pages/Settings'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'

describe('v2.0.27 settings footer', () => {
  beforeEach(() => {
    useAppStore.setState({ settings: { ...defaultSettings(), language: 'zh' } })
  })

  it('shows the copyright and contact-author rows at the end of the page', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText('版权所属')).toBeInTheDocument()
    expect(screen.getByText('怏')).toBeInTheDocument()
    expect(screen.getByText('联系作者')).toBeInTheDocument()
    expect(screen.getByText('2868377495')).toBeInTheDocument()
    expect(screen.getByText('Android 客户端')).toBeInTheDocument()
    expect(screen.getByText('下载 APK')).toBeInTheDocument()
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MuteToggle from './MuteToggle.jsx'

// The button reflects and flips the persisted mute preference. The audio engine
// itself never builds in jsdom (no AudioContext), so getAtmosphere() returns
// null and setMuted is a no-op here — this only covers the DOM + localStorage.

afterEach(() => {
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
})

describe('MuteToggle', () => {
  it('starts on "sound on" with no stored preference', () => {
    render(<MuteToggle />)
    const btn = screen.getByRole('button', { name: 'Mute audio' })
    expect(btn).toHaveTextContent('🔊')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles to muted on click and writes the preference', () => {
    render(<MuteToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Mute audio' }))

    const btn = screen.getByRole('button', { name: 'Unmute audio' })
    expect(btn).toHaveTextContent('🔇')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('yeti-survival:muted')).toBe('1')
  })

  it('reads an existing stored preference on mount', () => {
    localStorage.setItem('yeti-survival:muted', '1')
    render(<MuteToggle />)
    expect(
      screen.getByRole('button', { name: 'Unmute audio' }),
    ).toBeInTheDocument()
  })
})

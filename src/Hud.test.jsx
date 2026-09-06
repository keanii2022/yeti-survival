import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Hud from './Hud.jsx'
import { useGame } from './store.js'

// The HUD is a plain DOM overlay that mirrors the store: the start prompt, the
// live gauges, the pause card, and the two game-over cards. No canvas, so it
// renders straight into jsdom. src/test/setup.js resets the store first.

describe('Hud', () => {
  it('shows the start prompt before the pointer is locked', () => {
    render(<Hud locked={false} />)
    expect(
      screen.getByRole('heading', { name: 'Yeti Survival' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Click to look around')).toBeInTheDocument()
  })

  it('shows the gauges, score and ember count once locked and playing', () => {
    useGame.setState({ score: 400, itemsCollected: 3 })
    render(<Hud locked={true} />)

    expect(screen.getByText('Warmth')).toBeInTheDocument()
    expect(screen.getByText('Stamina')).toBeInTheDocument()
    expect(screen.getByText('400')).toBeInTheDocument()
    expect(screen.getByText('Embers 3/6')).toBeInTheDocument()
  })

  it('hides the stats when the pointer is not locked', () => {
    render(<Hud locked={false} />)
    expect(screen.queryByText('Warmth')).not.toBeInTheDocument()
  })

  it('relabels the stamina gauge "Winded" while sprint is locked out', () => {
    useGame.setState({ sprintLocked: true })
    render(<Hud locked={true} />)

    expect(screen.getByText('Winded')).toBeInTheDocument()
    expect(screen.queryByText('Stamina')).not.toBeInTheDocument()
  })

  it('shows the pause card when paused', () => {
    useGame.setState({ status: 'paused' })
    render(<Hud locked={true} />)
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
  })

  it('shows the yeti game-over card with the final score when caught', () => {
    useGame.setState({ status: 'caught', score: 950, itemsCollected: 4 })
    render(<Hud locked={true} />)

    expect(
      screen.getByRole('heading', { name: 'The yeti caught you' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Final score 950')).toBeInTheDocument()
    expect(screen.getByText('Embers collected 4/6')).toBeInTheDocument()
  })

  it('shows the cold game-over card when frozen', () => {
    useGame.setState({ status: 'frozen', score: 120 })
    render(<Hud locked={true} />)
    expect(
      screen.getByRole('heading', { name: 'You froze to death' }),
    ).toBeInTheDocument()
  })

  it('draws the crosshair only while a run is live and locked', () => {
    const { container, rerender } = render(<Hud locked={true} />)
    expect(container.querySelector('.crosshair')).not.toBeNull()

    useGame.setState({ status: 'caught' })
    rerender(<Hud locked={true} />)
    expect(container.querySelector('.crosshair')).toBeNull()
  })
})

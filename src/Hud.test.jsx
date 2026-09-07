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

  it('shows the gauges, score and level / ember count once locked and playing', () => {
    useGame.setState({ score: 400, itemsCollected: 3, level: 2, itemsTotal: 6 })
    render(<Hud locked={true} />)

    expect(screen.getByText('Warmth')).toBeInTheDocument()
    expect(screen.getByText('Stamina')).toBeInTheDocument()
    expect(screen.getByText('400')).toBeInTheDocument()
    expect(screen.getByText(/Level 2 · Embers 3\/6/)).toBeInTheDocument()
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

  it('leads the game-over card with level, then time survived, then the ember score', () => {
    useGame.setState({
      status: 'caught',
      level: 3,
      elapsed: 95.4,
      score: 400,
      embersTotal: 4,
    })
    render(<Hud locked={true} />)

    expect(
      screen.getByRole('heading', { name: 'The yeti caught you' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Level 3')).toBeInTheDocument()
    expect(screen.getByText('1:35')).toBeInTheDocument()
    expect(screen.getByText('4 × 100')).toBeInTheDocument()
    expect(screen.getByText('400')).toBeInTheDocument()
  })

  it('shows the interlude level card while a level is being cleared', () => {
    useGame.setState({ status: 'playing', level: 2, interlude: true })
    render(<Hud locked={true} />)

    expect(screen.getByRole('heading', { name: 'Level 3' })).toBeInTheDocument()
    expect(screen.getByText(/Catch your breath/)).toBeInTheDocument()
  })

  it('shows the win screen once the run is won, with a nightfall prompt', () => {
    useGame.setState({
      status: 'won',
      level: 8,
      elapsed: 300,
      score: 6000,
      embersTotal: 60,
    })
    render(<Hud locked={true} />)

    expect(screen.getByRole('heading', { name: 'Dawn breaks' })).toBeInTheDocument()
    expect(screen.getByText(/8 levels cleared/)).toBeInTheDocument()
    expect(screen.getByText('60 × 100')).toBeInTheDocument()
    expect(screen.getByText(/Press N/)).toBeInTheDocument()
  })

  it('shows a distinct win screen for clearing nightfall, with no further N prompt', () => {
    useGame.setState({ status: 'won', nightfall: true, level: 8, score: 9000, embersTotal: 90 })
    render(<Hud locked={true} />)

    expect(
      screen.getByRole('heading', { name: 'The night is over' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Press N/)).not.toBeInTheDocument()
    expect(screen.getByText('Press R to start over')).toBeInTheDocument()
  })

  it('offers a tap-to-restart button on the game-over card on touch', () => {
    useGame.setState({ status: 'caught', level: 2 })
    render(<Hud locked={false} isTouch={true} />)

    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Press R to try again')).not.toBeInTheDocument()
  })

  it('keeps the keyboard prompt (no button) on the game-over card on desktop', () => {
    useGame.setState({ status: 'caught', level: 2 })
    render(<Hud locked={true} />)

    expect(screen.getByText('Press R to try again')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('gives the win screen Nightfall + Start over buttons on touch', () => {
    useGame.setState({ status: 'won', level: 8, score: 6000, embersTotal: 60 })
    render(<Hud locked={false} isTouch={true} />)

    expect(screen.getByRole('button', { name: 'Nightfall' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument()
    expect(screen.queryByText(/Press N/)).not.toBeInTheDocument()
  })

  it('shows the cold game-over card when frozen', () => {
    useGame.setState({ status: 'frozen', score: 120 })
    render(<Hud locked={true} />)
    expect(
      screen.getByRole('heading', { name: 'You froze to death' }),
    ).toBeInTheDocument()
  })

  it('runs the gameplay HUD on a touch device with no pointer lock', () => {
    useGame.setState({ score: 250, itemsCollected: 1, level: 1, itemsTotal: 6 })
    render(<Hud locked={false} isTouch={true} />)

    expect(screen.getByText('Warmth')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.queryByText('Click to look around')).not.toBeInTheDocument()
  })

  it('marks the HUD root .touch on a touch device so the CSS can go full-bleed', () => {
    const { container, rerender } = render(<Hud locked={false} isTouch={true} />)
    expect(container.querySelector('.hud.touch')).not.toBeNull()

    rerender(<Hud locked={true} isTouch={false} />)
    expect(container.querySelector('.hud.touch')).toBeNull()
  })

  it('draws the crosshair only while a run is live and locked', () => {
    const { container, rerender } = render(<Hud locked={true} />)
    expect(container.querySelector('.crosshair')).not.toBeNull()

    useGame.setState({ status: 'caught' })
    rerender(<Hud locked={true} />)
    expect(container.querySelector('.crosshair')).toBeNull()
  })
})

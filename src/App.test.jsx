import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the chart component and supports calendar-driven ranges', () => {
    render(<App />)

    expect(screen.getByText(/over selected range/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByText(/selected period/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1D' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'S&P 500' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Line' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Area' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '1W' }))
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-02-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'S&P 500' }))
    fireEvent.click(screen.getByRole('button', { name: 'Line' }))

    expect(screen.getByText(/1 week: feb 15, 2026 - feb 21, 2026/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Line' })).toBeInTheDocument()
  })
})
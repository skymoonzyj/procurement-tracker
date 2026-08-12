import { render, screen } from '@testing-library/react'
import { App } from './App'

it('renders the procurement ledger shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: '采购报销台账' })).toBeInTheDocument()
})

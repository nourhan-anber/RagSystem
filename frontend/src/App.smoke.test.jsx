import { describe, test, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App'

// The mock API is what the UI runs against until the backend endpoints exist,
// so the smoke test drives the same path a developer sees in the browser.
vi.mock('./api', async () => {
  const { createMockApi, mockStreamAnswer } = await import('./api/mockApi')
  return { api: createMockApi(), askQuestion: mockStreamAnswer, USING_MOCKS: true }
})

describe('App', () => {
  test('renders the greeting and the workspace list', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Hello' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Wiki notes' })).toBeInTheDocument()
  })

  test('shows the composer ready for a question', async () => {
    render(<App />)

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ask about your documents')).toBeInTheDocument()
    )
    expect(screen.getByLabelText('Attach files')).toBeInTheDocument()
    expect(screen.getByLabelText('Send')).toBeDisabled()
  })

  test('the top bar menu button opens and dismisses the mobile drawer', async () => {
    const { container } = render(<App />)

    await screen.findByRole('button', { name: 'Wiki notes' })
    expect(container.querySelector('.sidebar')).not.toHaveClass('sidebar--open')

    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(container.querySelector('.sidebar')).toHaveClass('sidebar--open')

    fireEvent.click(screen.getByLabelText('Close menu'))
    expect(container.querySelector('.sidebar')).not.toHaveClass('sidebar--open')
  })

  test('asking a question streams an answer with its sources into the thread', async () => {
    render(<App />)

    const input = await screen.findByPlaceholderText('Ask about your documents')
    fireEvent.change(input, { target: { value: 'What is in these documents?' } })
    fireEvent.click(screen.getByLabelText('Send'))

    // The question appears immediately as its own turn.
    expect(await screen.findByText('What is in these documents?')).toBeInTheDocument()

    // The answer arrives progressively, then its sources become available.
    await screen.findByText(/Based on the documents in this workspace/, {}, { timeout: 10000 })
    await screen.findByRole('button', { name: /source/ }, { timeout: 10000 })
  }, 20000)
})

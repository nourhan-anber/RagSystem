import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Composer } from './Composer'

const QUESTION_FIELD = 'Ask about your documents'

function renderComposer(props = {}) {
  const handlers = {
    onSend: vi.fn(),
    onStop: vi.fn(),
    onAddFiles: vi.fn(),
    onRetryFile: vi.fn(),
    onDismissFile: vi.fn(),
  }

  const utils = render(
    <Composer
      files={props.files ?? []}
      canAsk={props.canAsk ?? false}
      filesLoading={props.filesLoading ?? false}
      isStreaming={props.isStreaming ?? false}
      {...handlers}
    />
  )

  return { ...utils, ...handlers }
}

const readyFile = { key: 'k1', name: 'code.txt', size: 10, status: 'ready' }
const indexingFile = { key: 'k2', name: 'code.txt', size: 10, status: 'uploading' }

describe('Composer', () => {
  test('hides the question field until a document is available', () => {
    renderComposer({ canAsk: false })

    expect(screen.queryByPlaceholderText(QUESTION_FIELD)).not.toBeInTheDocument()
  })

  test('offers an upload action when there is nothing to ask about', () => {
    renderComposer({ canAsk: false })

    expect(screen.getByRole('button', { name: /upload a document/i })).toBeInTheDocument()
  })

  test('shows the question field once a document is ready', () => {
    renderComposer({ canAsk: true, files: [readyFile] })

    expect(screen.getByPlaceholderText(QUESTION_FIELD)).toBeInTheDocument()
  })

  test('keeps the question field hidden while a document is still indexing', () => {
    renderComposer({ canAsk: false, files: [indexingFile] })

    expect(screen.queryByPlaceholderText(QUESTION_FIELD)).not.toBeInTheDocument()
  })

  test('says indexing is in progress rather than inviting another upload', () => {
    renderComposer({ canAsk: false, files: [indexingFile] })

    expect(screen.getByRole('button', { name: /indexing/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload a document/i })).not.toBeInTheDocument()
  })

  test('shows neither state while the file list is still loading', () => {
    // Otherwise a workspace that already has documents flashes the upload
    // prompt before its file list arrives.
    renderComposer({ canAsk: false, filesLoading: true })

    expect(screen.queryByPlaceholderText(QUESTION_FIELD)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload a document/i })).not.toBeInTheDocument()
  })

  test('the upload action opens the file picker', () => {
    const { container } = renderComposer({ canAsk: false })
    const picker = container.querySelector('input[type="file"]')
    const click = vi.spyOn(picker, 'click')

    fireEvent.click(screen.getByRole('button', { name: /upload a document/i }))

    expect(click).toHaveBeenCalled()
  })

  test('accepts a dropped file even while questions are locked', () => {
    const { container, onAddFiles } = renderComposer({ canAsk: false })
    const file = new File(['x'], 'code.txt', { type: 'text/plain' })

    fireEvent.drop(container.querySelector('.composer'), {
      dataTransfer: { files: [file] },
    })

    expect(onAddFiles).toHaveBeenCalled()
  })

  test('still sends a question when one is typed and documents exist', () => {
    const { onSend } = renderComposer({ canAsk: true, files: [readyFile] })

    fireEvent.change(screen.getByPlaceholderText(QUESTION_FIELD), {
      target: { value: 'what is the wind speed?' },
    })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(onSend).toHaveBeenCalledWith('what is the wind speed?')
  })
})

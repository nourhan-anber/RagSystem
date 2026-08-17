import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'

const workspaces = [
  { id: 'a', name: 'Research' },
  { id: 'b', name: 'Contracts' },
]

function renderSidebar(props = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onClose: vi.fn(),
    ...props,
  }

  render(
    <Sidebar
      workspaces={workspaces}
      activeId="a"
      loading={false}
      error={null}
      open={props.open ?? false}
      {...handlers}
    />
  )

  return handlers
}

describe('Sidebar', () => {
  test('lists every workspace', () => {
    renderSidebar()

    expect(screen.getByRole('button', { name: 'Research' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument()
  })

  test('keeps workspaces mounted while collapsed so the mobile drawer is never empty', () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Collapse sidebar'))

    expect(screen.getByRole('button', { name: 'Research' })).toBeInTheDocument()
  })

  test('closes the drawer after picking a workspace', () => {
    const { onSelect, onClose } = renderSidebar({ open: true })

    fireEvent.click(screen.getByRole('button', { name: 'Contracts' }))

    expect(onSelect).toHaveBeenCalledWith('b')
    expect(onClose).toHaveBeenCalled()
  })

  test('closes the drawer when the scrim is tapped', () => {
    const { onClose } = renderSidebar({ open: true })

    fireEvent.click(screen.getByTestId('sidebar-scrim'))

    expect(onClose).toHaveBeenCalled()
  })

  test('closes the drawer on Escape', () => {
    const { onClose } = renderSidebar({ open: true })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  test('renders no scrim while the drawer is shut', () => {
    renderSidebar({ open: false })

    expect(screen.queryByTestId('sidebar-scrim')).not.toBeInTheDocument()
  })

  test('ignores Escape while the drawer is shut', () => {
    const { onClose } = renderSidebar({ open: false })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })

  test('closes the drawer after creating a workspace', () => {
    const { onCreate, onClose } = renderSidebar({ open: true })

    fireEvent.click(screen.getByRole('button', { name: /New workspace/ }))
    fireEvent.change(screen.getByPlaceholderText('Workspace name'), {
      target: { value: 'Papers' },
    })
    fireEvent.submit(screen.getByPlaceholderText('Workspace name'))

    expect(onCreate).toHaveBeenCalledWith('Papers')
    expect(onClose).toHaveBeenCalled()
  })

  test('marks the drawer open state on the sidebar element', () => {
    const { container } = render(
      <Sidebar
        workspaces={workspaces}
        activeId="a"
        loading={false}
        error={null}
        open
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(container.querySelector('.sidebar')).toHaveClass('sidebar--open')
  })
})

import { useEffect, useState } from 'react'
import { CloseIcon, MenuIcon, PlusIcon } from './Icons'

/**
 * Two different behaviours share this markup:
 *
 * - Wide viewports: a permanent rail that collapses to an icon strip.
 * - Narrow viewports: an off-canvas drawer over the conversation, opened from
 *   the top bar and dismissed by the scrim, Escape, or making a choice.
 *
 * The content stays mounted in both cases, so rotating or resizing a device
 * never reveals an empty drawer. Which behaviour applies is decided in CSS.
 */
export function Sidebar({ workspaces, activeId, onSelect, onCreate, onClose, open, loading, error }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)

    // Stop the conversation behind the drawer from scrolling under it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  function pick(id) {
    onSelect(id)
    onClose()
  }

  function submitDraft(event) {
    event.preventDefault()
    const name = draftName.trim()
    if (!name) return

    onCreate(name)
    setDraftName('')
    setDrafting(false)
    onClose()
  }

  const classes = [
    'sidebar',
    collapsed ? 'sidebar--collapsed' : '',
    open ? 'sidebar--open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {open && <div className="scrim" data-testid="sidebar-scrim" onClick={onClose} />}

      <aside className={classes}>
        <div className="sidebar__head">
          <button
            type="button"
            className="icon-button sidebar__toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <MenuIcon />
          </button>

          <button
            type="button"
            className="icon-button sidebar__dismiss"
            onClick={onClose}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="sidebar__body">
          {drafting ? (
            <form className="sidebar__draft" onSubmit={submitDraft}>
              <input
                autoFocus
                className="sidebar__draft-input"
                value={draftName}
                placeholder="Workspace name"
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => !draftName.trim() && setDrafting(false)}
              />
            </form>
          ) : (
            <button type="button" className="sidebar__new" onClick={() => setDrafting(true)}>
              <PlusIcon width={18} height={18} />
              <span className="sidebar__new-label">New workspace</span>
            </button>
          )}

          <p className="sidebar__label">Workspaces</p>

          <nav className="sidebar__list">
            {loading && <p className="sidebar__hint">Loading…</p>}
            {error && <p className="sidebar__hint sidebar__hint--error">{error}</p>}
            {!loading && !error && workspaces.length === 0 && (
              <p className="sidebar__hint">No workspaces yet.</p>
            )}

            {workspaces.map((workspace) => (
              <button
                type="button"
                key={workspace.id}
                className={`sidebar__item ${workspace.id === activeId ? 'sidebar__item--active' : ''}`}
                onClick={() => pick(workspace.id)}
              >
                {workspace.name}
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}

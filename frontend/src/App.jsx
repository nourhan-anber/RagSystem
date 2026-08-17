import { useCallback, useEffect, useRef, useState } from 'react'
import { api, USING_MOCKS } from './api'
import { useChat } from './chat/useChat'
import { useFiles } from './files/useFiles'
import { Sidebar } from './components/Sidebar'
import { MenuIcon } from './components/Icons'
import { ChatThread } from './components/ChatThread'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import './styles/app.css'

export default function App() {
  const [workspaces, setWorkspaces] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  // Only meaningful on narrow viewports, where the rail becomes a drawer.
  const [navOpen, setNavOpen] = useState(false)
  const closeNav = useCallback(() => setNavOpen(false), [])

  useEffect(() => {
    let cancelled = false

    api
      .listWorkspaces()
      .then((loaded) => {
        if (cancelled) return
        setWorkspaces(loaded)
        setActiveId((current) => current ?? loaded[0]?.id ?? null)
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [])

  const createWorkspace = useCallback(async (name) => {
    try {
      const workspace = await api.createWorkspace(name)
      setWorkspaces((current) => [workspace, ...current])
      setActiveId(workspace.id)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])

  const nav = {
    workspaces,
    activeId,
    onSelect: setActiveId,
    onCreate: createWorkspace,
    onClose: closeNav,
    open: navOpen,
    loading,
    error: loadError,
  }

  return activeId ? (
    <Workspace key={activeId} nav={nav} onOpenNav={() => setNavOpen(true)} />
  ) : (
    <div className="app">
      <Sidebar {...nav} />
      <main className="main">
        <TopBar title="mini-RAG" onOpenNav={() => setNavOpen(true)} />
        <div className="empty">
          <h1 className="empty__greeting">Hello</h1>
          <p className="empty__sub">Create a workspace to upload documents and ask questions.</p>
        </div>
      </main>
    </div>
  )
}

function TopBar({ title, onOpenNav }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-button topbar__menu" aria-label="Open menu" onClick={onOpenNav}>
        <MenuIcon />
      </button>
      <span className="topbar__title">{title}</span>
      {USING_MOCKS && <span className="topbar__badge">mock data</span>}
    </header>
  )
}

// Remounted per workspace (via key), so chat and file state never leak across a switch.
function Workspace({ nav, onOpenNav }) {
  const { workspaces, activeId } = nav
  const { messages, isStreaming, send, stop } = useChat(activeId)
  const { files, readyCount, addFiles, retry, dismiss } = useFiles(activeId)
  const lastQuestionRef = useRef(null)

  const active = workspaces.find((w) => w.id === activeId)

  const ask = useCallback(
    (text) => {
      lastQuestionRef.current = text
      send(text)
    },
    [send]
  )

  const retryAnswer = useCallback(() => {
    if (lastQuestionRef.current) send(lastQuestionRef.current)
  }, [send])

  return (
    <div className="app">
      <Sidebar {...nav} />

      <main className="main">
        <TopBar title={active?.name ?? 'Workspace'} onOpenNav={onOpenNav} />

        {messages.length === 0 ? (
          <div className="thread">
            <EmptyState
              workspaceName={active?.name ?? 'this workspace'}
              hasFiles={readyCount > 0}
              onSuggest={ask}
            />
          </div>
        ) : (
          <ChatThread messages={messages} onRetry={retryAnswer} />
        )}

        <div className="composer-dock">
          <Composer
            files={files}
            isStreaming={isStreaming}
            onSend={ask}
            onStop={stop}
            onAddFiles={addFiles}
            onRetryFile={retry}
            onDismissFile={dismiss}
          />
        </div>
      </main>
    </div>
  )
}

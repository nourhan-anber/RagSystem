import { useState } from 'react'
import { ChevronIcon, FileIcon } from './Icons'

export function Sources({ sources }) {
  const [open, setOpen] = useState(false)

  if (!sources || sources.length === 0) return null

  return (
    <div className="sources">
      <button
        type="button"
        className="sources__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronIcon
          width={16}
          height={16}
          className={`sources__chevron ${open ? 'sources__chevron--open' : ''}`}
        />
        {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      </button>

      {open && (
        <ol className="sources__list">
          {sources.map((source, index) => (
            <li key={index} className="sources__item">
              <div className="sources__meta">
                <FileIcon width={14} height={14} />
                <span className="sources__file">{source.file ?? 'Document'}</span>
                {typeof source.score === 'number' && (
                  <span className="sources__score">{source.score.toFixed(2)}</span>
                )}
              </div>
              <p className="sources__text">{source.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

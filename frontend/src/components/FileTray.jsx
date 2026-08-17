import { CloseIcon, FileIcon } from './Icons'

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileTray({ files, onRetry, onDismiss }) {
  if (files.length === 0) return null

  return (
    <ul className="tray">
      {files.map((file) => (
        <li key={file.key} className={`chip chip--${file.status}`}>
          <FileIcon width={14} height={14} />

          <span className="chip__name" title={file.error ?? file.name}>
            {file.name}
          </span>

          {file.status === 'uploading' && <span className="chip__status">Indexing…</span>}
          {file.status === 'ready' && formatSize(file.size) && (
            <span className="chip__status">{formatSize(file.size)}</span>
          )}
          {file.status === 'error' && (
            <button type="button" className="chip__action" onClick={() => onRetry(file.key)}>
              Retry
            </button>
          )}

          <button
            type="button"
            className="chip__close"
            aria-label={`Remove ${file.name}`}
            onClick={() => onDismiss(file.key)}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

const SUGGESTIONS = [
  'Summarise the main points of these documents',
  'What questions do these documents answer?',
  'List the key figures mentioned',
]

export function EmptyState({ workspaceName, hasFiles, onSuggest }) {
  return (
    <div className="empty">
      <h1 className="empty__greeting">Hello</h1>
      <p className="empty__sub">
        {hasFiles
          ? `Ask anything about the documents in ${workspaceName}.`
          : 'Upload a document to start asking questions about it.'}
      </p>

      {hasFiles && (
        <div className="empty__suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              className="suggestion"
              onClick={() => onSuggest(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

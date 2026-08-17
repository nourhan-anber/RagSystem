import { useRef, useState } from 'react'
import { AttachIcon, SendIcon, StopIcon } from './Icons'
import { FileTray } from './FileTray'

export function Composer({ files, isStreaming, onSend, onStop, onAddFiles, onRetryFile, onDismissFile }) {
  const [value, setValue] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  function resize(element) {
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }

  function submit() {
    if (!value.trim() || isStreaming) return
    onSend(value)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(event) {
    // Enter sends; Shift+Enter is a newline, as in Gemini.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.length) onAddFiles(event.dataTransfer.files)
  }

  return (
    <div
      className={`composer ${dragging ? 'composer--dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <FileTray files={files} onRetry={onRetryFile} onDismiss={onDismissFile} />

      <div className="composer__bar">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.pdf,text/plain,application/pdf"
          className="visually-hidden"
          onChange={(event) => {
            if (event.target.files?.length) onAddFiles(event.target.files)
            event.target.value = ''
          }}
        />

        <button
          type="button"
          className="icon-button"
          aria-label="Attach files"
          onClick={() => fileInputRef.current?.click()}
        >
          <AttachIcon />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          className="composer__input"
          placeholder="Ask about your documents"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            resize(event.target)
          }}
          onKeyDown={handleKeyDown}
        />

        {isStreaming ? (
          <button type="button" className="icon-button icon-button--filled" aria-label="Stop" onClick={onStop}>
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            className="icon-button icon-button--filled"
            aria-label="Send"
            disabled={!value.trim()}
            onClick={submit}
          >
            <SendIcon />
          </button>
        )}
      </div>

      <p className="composer__note">
        {dragging ? 'Drop files to add them to this workspace' : 'Answers come only from your uploaded documents.'}
      </p>
    </div>
  )
}

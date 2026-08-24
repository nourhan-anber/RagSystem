import { useRef, useState } from 'react'
import { AttachIcon, SendIcon, StopIcon } from './Icons'
import { FileTray } from './FileTray'

/**
 * The question field only appears once the workspace has at least one indexed
 * document. Asking before then can only produce "there is nothing to answer
 * from", so the composer leads with the upload action instead of inviting a
 * question it cannot answer.
 */
export function Composer({
  files,
  canAsk,
  filesLoading,
  isStreaming,
  onSend,
  onStop,
  onAddFiles,
  onRetryFile,
  onDismissFile,
}) {
  const [value, setValue] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const isIndexing = files.some((file) => file.status === 'uploading')

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

  function openPicker() {
    fileInputRef.current?.click()
  }

  const picker = (
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
  )

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

      {/* While the file list is in flight neither state is correct yet: a
          workspace that already has documents would flash the upload prompt. */}
      {filesLoading ? (
        picker
      ) : canAsk ? (
        <div className="composer__bar">
          {picker}

          <button type="button" className="icon-button" aria-label="Attach files" onClick={openPicker}>
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
      ) : (
        <div className="composer__upload">
          {picker}

          <button type="button" className="upload-button" onClick={openPicker} disabled={isIndexing}>
            <AttachIcon width={18} height={18} />
            {isIndexing ? 'Indexing your document…' : 'Upload a document'}
          </button>
        </div>
      )}

      <p className="composer__note">
        {dragging
          ? 'Drop files to add them to this workspace'
          : filesLoading
            ? ''
            : canAsk
              ? 'Answers come only from your uploaded documents.'
              : isIndexing
                ? 'You can ask questions as soon as indexing finishes.'
                : 'Upload a .txt or .pdf to start asking questions about it.'}
      </p>
    </div>
  )
}

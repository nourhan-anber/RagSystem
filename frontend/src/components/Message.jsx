import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SparkleIcon } from './Icons'
import { Sources } from './Sources'

function UserTurn({ message }) {
  return (
    <div className="turn turn--user">
      <div className="bubble">{message.text}</div>
    </div>
  )
}

function AssistantTurn({ message, onRetry }) {
  const waiting = message.status === 'streaming' && message.text === ''

  return (
    <div className="turn turn--assistant">
      <div className={`avatar ${message.status === 'streaming' ? 'avatar--busy' : ''}`}>
        <SparkleIcon width={18} height={18} />
      </div>

      <div className="turn__body">
        {waiting ? (
          <div className="thinking" aria-label="Generating answer">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="answer">
            <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
            {message.status === 'streaming' && <span className="caret" />}
          </div>
        )}

        {message.status === 'error' && (
          <div className="answer-error">
            <span>{message.error}</span>
            {onRetry && (
              <button type="button" className="link-button" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}

        {message.status !== 'streaming' && <Sources sources={message.sources} />}
      </div>
    </div>
  )
}

export function Message({ message, onRetry }) {
  return message.role === 'user' ? (
    <UserTurn message={message} />
  ) : (
    <AssistantTurn message={message} onRetry={onRetry} />
  )
}

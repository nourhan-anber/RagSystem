import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

let sequence = 0
const nextKey = () => `f-local-${++sequence}`

/**
 * Tracks the documents attached to a workspace. A file is shown the instant it
 * is dropped, then follows upload -> ready (or error), because ingestion takes
 * long enough that silence would read as a broken interface.
 */
export function useFiles(projectId) {
  const [files, setFiles] = useState([])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setFiles([])
    setLoadError(null)

    api
      .listFiles(projectId)
      .then((loaded) => {
        if (!cancelled) {
          setFiles(loaded.map((file) => ({ ...file, key: nextKey(), status: 'ready' })))
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  const upload = useCallback(
    async (key, file) => {
      try {
        const record = await api.ingestFile(projectId, file)
        setFiles((current) =>
          current.map((f) => (f.key === key ? { ...f, ...record, status: 'ready' } : f))
        )
      } catch (err) {
        setFiles((current) =>
          current.map((f) => (f.key === key ? { ...f, status: 'error', error: err.message } : f))
        )
      }
    },
    [projectId]
  )

  const addFiles = useCallback(
    (incoming) => {
      const queued = Array.from(incoming).map((file) => ({
        key: nextKey(),
        name: file.name,
        size: file.size,
        status: 'uploading',
        source: file,
      }))

      setFiles((current) => [...current, ...queued])
      queued.forEach((entry) => upload(entry.key, entry.source))
    },
    [upload]
  )

  const retry = useCallback(
    (key) => {
      setFiles((current) =>
        current.map((f) => (f.key === key ? { ...f, status: 'uploading', error: null } : f))
      )
      const entry = files.find((f) => f.key === key)
      if (entry?.source) upload(key, entry.source)
    },
    [files, upload]
  )

  const dismiss = useCallback((key) => {
    setFiles((current) => current.filter((f) => f.key !== key))
  }, [])

  const readyCount = files.filter((f) => f.status === 'ready').length

  return { files, readyCount, loadError, addFiles, retry, dismiss }
}

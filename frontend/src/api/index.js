import { createApi } from './client'
import { streamAnswer } from './answerStream'
import { createMockApi, mockStreamAnswer } from './mockApi'

// The backend endpoints this UI needs (/data/ingest, /data/projects, /nlp/answer)
// do not exist yet. Until they do, VITE_USE_MOCKS=true drives the UI from an
// in-memory double. Flip the flag in .env to talk to the real FastAPI app.
export const USING_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export const api = USING_MOCKS ? createMockApi() : createApi()
export const askQuestion = USING_MOCKS ? mockStreamAnswer : streamAnswer

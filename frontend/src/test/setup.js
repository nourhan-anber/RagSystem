import '@testing-library/jest-dom/vitest'

// jsdom does not implement scrollIntoView, which the thread uses to follow a
// streaming answer. Real browsers provide it.
Element.prototype.scrollIntoView = () => {}

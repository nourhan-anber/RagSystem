// Inline SVG keeps the bundle free of an icon dependency.
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor' }

export const MenuIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
  </svg>
)

export const PlusIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
  </svg>
)

export const AttachIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M16.5 6v11.5a4.5 4.5 0 1 1-9 0V5a3 3 0 0 1 6 0v10.5a1.5 1.5 0 0 1-3 0V6H9v9.5a3 3 0 0 0 6 0V5a4.5 4.5 0 0 0-9 0v12.5a6 6 0 0 0 12 0V6h-1.5z" />
  </svg>
)

export const SendIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3.4 20.4 21 12 3.4 3.6 3.39 10.13 15.5 12l-12.11 1.87.01 6.53z" />
  </svg>
)

export const StopIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)

export const FileIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 2h8l4 4v16H6V2zm7 1.5V7h3.5L13 3.5z" />
  </svg>
)

export const ChevronIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4z" />
  </svg>
)

export const CloseIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m12 10.6 4.9-4.9 1.4 1.4-4.9 4.9 4.9 4.9-1.4 1.4-4.9-4.9-4.9 4.9-1.4-1.4 4.9-4.9-4.9-4.9 1.4-1.4 4.9 4.9z" />
  </svg>
)

export const SparkleIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2.5 14.1 9 20.6 11.1 14.1 13.2 12 19.7 9.9 13.2 3.4 11.1 9.9 9 12 2.5z" />
  </svg>
)

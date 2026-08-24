/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],

  corePlugins: {
    // Preflight is Tailwind's base reset. It sets `ul, ol { list-style: none }`
    // and flattens heading sizes, which would break answer rendering: answers
    // are markdown (react-markdown + remark-gfm) and app.css styles only
    // pre/code/table inside .answer, so headings, lists and paragraphs rely on
    // browser defaults. Tailwind is additive here rather than a replacement for
    // the existing design system.
    preflight: false,

    // Emitted unconditionally rather than on use, and nothing here uses it.
    container: false,
  },

  theme: {
    extend: {
      // Mirrors the CSS variables in styles/app.css so utilities such as
      // `bg-surface` or `text-muted` follow the light/dark theme automatically.
      colors: {
        bg: 'var(--bg)',
        rail: 'var(--bg-rail)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        line: 'var(--border)',
        body: 'var(--text)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
      },
    },
  },

  plugins: [],
}

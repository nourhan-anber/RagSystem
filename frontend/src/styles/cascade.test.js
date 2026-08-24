import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// vitest runs with the project root as cwd.
// Comments are stripped first: an unstripped comment attaches to the selector
// that follows it and would silently exclude that rule from the resolver.
const css = readFileSync(resolve('src/styles/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Resolves which `display` value actually wins for an element, honouring
 * specificity and source order.
 *
 * Checking that a rule merely *exists* is not enough: these buttons carry
 * .icon-button as well, which also sets display, so whichever rule comes last
 * at equal specificity is the one that takes effect.
 */
function resolveDisplay({ classes, ancestors = [], narrow = false }) {
  const body = narrow
    ? (css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/) || [, ''])[1]
    : css
  // Outside the media query, only top-level rules count.
  const scoped = narrow ? body : css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '')

  let winner = null
  let best = -1
  let order = 0

  for (const match of scoped.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declarations = match[2]
    const display = declarations.match(/(?:^|;)\s*display:\s*([^;]+)/)
    if (!display) continue

    for (const selector of match[1].split(',').map((s) => s.trim())) {
      if (!selector.startsWith('.')) continue
      const parts = selector.split(/\s+/)
      const own = parts[parts.length - 1].split('.').filter(Boolean)
      if (!own.every((c) => classes.includes(c))) continue

      const needed = parts.slice(0, -1).map((p) => p.replace('.', ''))
      const ok = needed.every((n) => ancestors.some((a) => a.includes(n)))
      if (!ok) continue

      const specificity = selector.split('.').length - 1
      if (specificity >= best) {
        best = specificity
        winner = display[1].trim()
      }
    }
    order += 1
  }

  return winner
}

const TOPBAR_MENU = { classes: ['icon-button', 'topbar__menu'], ancestors: [['topbar']] }
const SIDEBAR_DISMISS = { classes: ['icon-button', 'sidebar__dismiss'], ancestors: [['sidebar']] }
const SIDEBAR_TOGGLE = { classes: ['icon-button', 'sidebar__toggle'], ancestors: [['sidebar']] }

describe('responsive visibility', () => {
  test('the top bar menu button is hidden on desktop', () => {
    expect(resolveDisplay(TOPBAR_MENU)).toBe('none')
  })

  test('the top bar menu button is shown on mobile', () => {
    expect(resolveDisplay({ ...TOPBAR_MENU, narrow: true })).toBe('inline-flex')
  })

  test('the drawer close button is hidden on desktop', () => {
    expect(resolveDisplay(SIDEBAR_DISMISS)).toBe('none')
  })

  test('the drawer close button is shown on mobile', () => {
    expect(resolveDisplay({ ...SIDEBAR_DISMISS, narrow: true })).toBe('inline-flex')
  })

  test('the sidebar collapse toggle is shown on desktop', () => {
    expect(resolveDisplay(SIDEBAR_TOGGLE)).toBe('inline-flex')
  })

  test('the sidebar collapse toggle is hidden on mobile', () => {
    expect(resolveDisplay({ ...SIDEBAR_TOGGLE, narrow: true })).toBe('none')
  })
})

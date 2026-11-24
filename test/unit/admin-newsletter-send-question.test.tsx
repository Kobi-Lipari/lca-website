// @vitest-environment jsdom
//
// The page's question before a newsletter goes to the list (SendQuestion.tsx, the build note's 5.6), drawn alone: its
// name and words by the count, the focus on "Not now" as it opens, Escape as "Not now", a press outside doing nothing,
// the site's root inert while it is open, the focus back where it came from, and "Sending..." while the send is posted.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SendQuestion } from '@/areas/admin/newsletter/SendQuestion'

let root: HTMLElement
let opener: HTMLButtonElement

beforeEach(() => {
  root = document.createElement('div')
  root.id = 'root'
  opener = document.createElement('button')
  opener.textContent = 'Send to 155 people'
  root.appendChild(opener)
  document.body.appendChild(root)
})
afterEach(() => {
  cleanup()
  root.remove()
})

function ask(props: Partial<Parameters<typeof SendQuestion>[0]> = {}) {
  const onAnswer = vi.fn()
  const drawn = render(
    <SendQuestion asking={{ willGet: 155, subject: 'Sample subject' }} posting={false} onAnswer={onAnswer} returnTo={() => opener} {...props} />,
    { container: document.body.appendChild(document.createElement('div')) },
  )
  return { onAnswer, ...drawn }
}

describe('the question before a newsletter is sent', () => {
  it('is an alert dialog named by the count, with the subject and that it cannot be taken back', () => {
    ask()
    const question = screen.getByRole('alertdialog', { name: 'Send to 155 people?' })
    expect(question.getAttribute('aria-modal')).toBe('true')
    expect(question.textContent).toContain('“Sample subject” goes to the LCA newsletter list.')
    expect(question.textContent).toContain('A sent newsletter cannot be taken back.')
    const words = screen.getByText(/goes to the LCA newsletter list/)
    expect(words.className).toContain('[overflow-wrap:anywhere]')
    for (const button of [screen.getByRole('button', { name: 'Not now' }), screen.getByRole('button', { name: 'Send' })]) {
      expect(button.className).toContain('min-h-11')
      // 48 pixels on a phone, 44 from 768 pixels up.
      expect(button.className.split(' ')).toEqual(expect.arrayContaining(['min-h-12', 'md:min-h-11']))
    }
  })

  it('says "person" for one', () => {
    ask({ asking: { willGet: 1, subject: 'Sample subject' } })
    expect(screen.getByRole('alertdialog', { name: 'Send to 1 person?' })).not.toBeNull()
  })

  it('takes the focus to "Not now", keeps the root inert while open, and Escape is "Not now"', () => {
    const { onAnswer } = ask()
    expect(document.activeElement?.textContent).toBe('Not now')
    expect(root.hasAttribute('inert')).toBe(true)
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('answers Send with true, and a press outside does nothing', () => {
    const { onAnswer } = ask()
    fireEvent.pointerDown(document.querySelector('[data-slot="send-scrim"]') as HTMLElement)
    expect(onAnswer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('while posting reads "Sending...", both answers not available and Escape doing nothing', () => {
    const { onAnswer } = ask({ posting: true })
    const send = screen.getByRole('button', { name: 'Sending...' })
    expect(send.getAttribute('aria-disabled')).toBe('true')
    const notNow = screen.getByRole('button', { name: 'Not now' })
    expect(notNow.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(send)
    fireEvent.click(notNow)
    fireEvent.keyDown(notNow, { key: 'Escape' })
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('gives the focus back to the opener and lets the root go as it closes', async () => {
    const { rerender, onAnswer } = ask()
    act(() => {
      rerender(<SendQuestion asking={null} posting={false} onAnswer={onAnswer} returnTo={() => opener} />)
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(root.hasAttribute('inert')).toBe(false)
    // The dialog gives the focus back a moment after it closes, as the chooser's question does.
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })
})

// @vitest-environment jsdom
//
// The admin News posts panel's first load (src/areas/admin/components/PostsPanel.tsx).
// Step 23 changed it to set the list from the request's own callback rather
// than from a function the effect calls (a lint fix in a file the step
// touched), and moved useViewOnly to src/hooks/useViewOnly.ts. What an
// admin sees must be what it was: "Loading…", then the posts with their
// status in words, or the request's own error message, "Failed to load
// posts" when the error carries none, and no New post button for an LCA
// Observer. Under StrictMode the list still shows once, and a panel closed
// before the request answers logs nothing.
import { StrictMode, type ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const api = vi.hoisted(() => ({ adminGetPosts: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { PostsPanel } = await import('@/areas/admin/components/PostsPanel')

const POSTS = [
  { id: 'fx-post-pinned', slug: 'fixture-pinned', title: 'Fixture pinned notice', summary: 'Club night moves to Thursday, 7:00 PM.', image_url: null, link_url: null, link_label: null, status: 'published', pinned: 1, published_at: '2026-10-01 18:00:00' },
  { id: 'fx-post-draft', slug: 'fixture-draft', title: 'Fixture draft recap', summary: '', image_url: null, link_url: null, link_label: null, status: 'draft', pinned: 0, published_at: null },
]

const as = (role: string) => ({ user: { id: 'fx-m-p1' }, member: { id: 'fx-m-p1', role }, session: null, role, loading: false }) as unknown as AuthContextValue

function show(role: string, strict = false) {
  const panel: ReactNode = (
    <AuthContext.Provider value={as(role)}>
      <PostsPanel />
    </AuthContext.Provider>
  )
  return render(strict ? <StrictMode>{panel}</StrictMode> : panel)
}

beforeEach(() => {
  api.adminGetPosts.mockReset()
})
afterEach(cleanup)

describe('the News posts panel, first load', () => {
  it('shows "Loading…", then every post with its status in words', async () => {
    let answer: (posts: unknown) => void = () => {}
    api.adminGetPosts.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    show('admin')
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    await act(async () => answer(POSTS))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Fixture pinned notice')).toBeTruthy()
    expect(screen.getByText('Fixture draft recap')).toBeTruthy()
    expect(screen.getByText('Published')).toBeTruthy()
    // "Draft" is both the date line and the status word of the draft.
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText('Pinned')).toBeTruthy()
    expect(api.adminGetPosts).toHaveBeenCalledTimes(1)
  })

  it('says "No posts yet." for an empty list', async () => {
    api.adminGetPosts.mockResolvedValue([])
    show('admin')
    expect(await screen.findByText('No posts yet.')).toBeTruthy()
  })

  it('shows the request\'s own message when it fails', async () => {
    api.adminGetPosts.mockRejectedValue(new Error('The server is not answering. Try again in a minute.'))
    show('admin')
    expect(await screen.findByText('The server is not answering. Try again in a minute.')).toBeTruthy()
    // The list never arrived, so it is still loading underneath the message.
    expect(screen.getByRole('status').textContent).toBe('Loading…')
  })

  it('says "Failed to load posts" when the failure carries no message', async () => {
    api.adminGetPosts.mockRejectedValue('offline')
    show('admin')
    expect(await screen.findByText('Failed to load posts')).toBeTruthy()
  })

  it('gives an admin the New post button and an LCA Observer none (useViewOnly, from its own module now)', async () => {
    api.adminGetPosts.mockResolvedValue(POSTS)
    show('admin')
    expect(await screen.findByRole('button', { name: /New post/ })).toBeTruthy()
    cleanup()
    show('lca_observer')
    await screen.findByText('Fixture pinned notice')
    expect(screen.queryByRole('button', { name: /New post/ })).toBeNull()
  })

  it('under StrictMode shows the list once', async () => {
    api.adminGetPosts.mockResolvedValue(POSTS)
    show('admin', true)
    expect(await screen.findAllByText('Fixture pinned notice')).toHaveLength(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('closed before the request answers, it logs nothing when the answer comes', async () => {
    let answer: (posts: unknown) => void = () => {}
    api.adminGetPosts.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { unmount } = show('admin')
      unmount()
      await act(async () => answer(POSTS))
      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
    }
  })
})

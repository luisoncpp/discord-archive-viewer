import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('renders integration heading', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          nextCursor: null,
          prevCursor: null,
        }),
        { status: 200 },
      ),
    )

    render(<App />)
    expect(screen.getByText(/Discord Archive Viewer API Integration/i)).toBeInTheDocument()
  })
})

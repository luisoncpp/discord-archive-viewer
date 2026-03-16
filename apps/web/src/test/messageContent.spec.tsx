import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageContent } from '../features/messages/MessageContent'

describe('MessageContent', () => {
  it('renders basic discord-like markdown inline styles', () => {
    render(
      <MessageContent
        content={'Hola **negrita** *italica* ~~tachado~~ `codigo`'}
        attachmentsRaw={null}
        reactionsRaw={null}
      />,
    )

    expect(screen.getByText('negrita').tagName).toBe('STRONG')
    expect(screen.getByText('italica').tagName).toBe('EM')
    expect(screen.getByText('tachado').tagName).toBe('S')
    expect(screen.getByText('codigo').tagName).toBe('CODE')
  })

  it('renders fenced code blocks', () => {
    render(
      <MessageContent
        content={'```ts\nconst x = 1\nconsole.log(x)\n```'}
        attachmentsRaw={null}
        reactionsRaw={null}
      />,
    )

    const codeNode = screen.getByText(/const x = 1/) 
    expect(codeNode.tagName).toBe('CODE')
    expect(codeNode.parentElement?.tagName).toBe('PRE')
  })

  it('renders autolinks', () => {
    render(
      <MessageContent
        content={'Revisa https://example.com/docs'}
        attachmentsRaw={null}
        reactionsRaw={null}
      />,
    )

    const link = screen.getByRole('link', { name: 'https://example.com/docs' })
    expect(link).toHaveAttribute('href', 'https://example.com/docs')
  })

  it('renders image embed from first eligible url', () => {
    render(
      <MessageContent
        content={'https://cdn.example.com/image.png'}
        attachmentsRaw={null}
        reactionsRaw={null}
      />,
    )

    const image = screen.getByRole('img', { name: /embedded image/i })
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/image.png')
  })

  it('renders youtube embed with fallback link', () => {
    render(
      <MessageContent
        content={'https://youtu.be/dQw4w9WgXcQ'}
        attachmentsRaw={null}
        reactionsRaw={null}
      />,
    )

    const iframe = screen.getByTitle(/YouTube video/i)
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(screen.getByRole('link', { name: /Abrir video original/i })).toBeInTheDocument()
  })

  it('does not render embed when no eligible url exists', () => {
    render(<MessageContent content={'solo texto'} attachmentsRaw={null} reactionsRaw={null} />)
    expect(screen.queryByTestId('message-embed')).not.toBeInTheDocument()
  })

  it('renders reactions from reactions_raw', () => {
    render(
      <MessageContent
        content={'mensaje con reacciones'}
        attachmentsRaw={null}
        reactionsRaw={'🤣 (2),gordosbAdrianwow (1),❤️ (3)'}
      />,
    )

    expect(screen.getByTestId('message-reactions')).toBeInTheDocument()
    expect(screen.getByText('🤣')).toBeInTheDocument()
    expect(screen.getByText('gordosbAdrianwow')).toBeInTheDocument()
    expect(screen.getByText('❤️')).toBeInTheDocument()
  })

  it('renders potentially unsafe html as text instead of executing it', () => {
    const { container } = render(
      <MessageContent content={'<script>alert("xss")</script>'} attachmentsRaw={null} reactionsRaw={null} />,
    )

    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })
})

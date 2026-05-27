import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SSE Board | Visual Stream Formatter',
  description: 'Parse, replay, and export Server-Sent Event streams on a visual workspace.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

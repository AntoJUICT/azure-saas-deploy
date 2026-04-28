import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Starter App',
  description: 'Azure SaaS starter',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Clarity — Your Therapy Co-Pilot',
  description:
    'Clarity turns your therapy session recordings into structured notes, action items, and a prep brief for next time. 100% private.',
  openGraph: {
    title: 'Clarity — Your Therapy Co-Pilot',
    description:
      'Make every therapy session count. Clarity turns your session recordings into structured notes, action items, and a prep brief for next time.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clarity — Your Therapy Co-Pilot',
    description: 'Make every therapy session count.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}

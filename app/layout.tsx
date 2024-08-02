import './globals.css'
import localFont from 'next/font/local'
import { Open_Sans } from 'next/font/google'
import type { Metadata } from 'next';
import Script from 'next/script'

const openSans = Open_Sans({ subsets: ['latin'] })

const championFont = localFont({
  src: '../public/fonts/Champion-HTF-Lightweight.otf',
  variable: '--font-champion',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LogoPack – Logo Variants In Seconds',
  description: 'Generate variants of your logo files in seconds.'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${championFont.variable} ${openSans.className}`}>
      {/*
        <head /> will contain the components returned by the nearest parent
        head.tsx. Find out more at https://beta.nextjs.org/docs/api-reference/file-conventions/head
      */}
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-R7HW2GYS9H" ></Script>
        <Script id='google-analytics' strategy="afterInteractive">
          {
              `window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
            
              gtag('config', 'G-R7HW2GYS9H');`
          }
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com"></link>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"></link>
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet"></link>
        <link href="https://db.onlinewebfonts.com/c/6aba8df63a0880037f4cd204805dbfea?family=Champion-HTF-Lightweight" rel="stylesheet" ></link>
        <meta property="og:image" content="/opengraph-image.png"></meta>
        <meta property="og:image:width" content="1200"></meta>
        <meta property="og:image:height" content="630"></meta>
        <meta property="og:image:alt" content="Logopack OG Image"></meta>
        <meta property="og:type" content="website"></meta>
        <meta name="twitter:card" content="summary_large_image"></meta>
        <meta name="twitter:title" content="Logopack"></meta>
        <meta name="twitter:description" content="Generate logo files in seconds."></meta>
        <meta name="twitter:image" content="/opengraph-image.png"></meta>
      </head>
      <body className={`${championFont.variable} ${openSans.className}`}>
        {children}
        <Script id="font-loading" strategy="afterInteractive">
          {`
            if ("fonts" in document) {
              document.fonts.load("1em Champion-HTF-Lightweight").then(() => {
                document.documentElement.classList.add('champion-font-loaded');
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}

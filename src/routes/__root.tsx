import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import LenisSmoothScrollProvider from '../providers/LenisSmoothScrollProvider'
import { ThemeProvider } from '../providers/ThemeProvider'
import { Toaster } from 'react-hot-toast'
import ErrorPage from '../components/ErrorPage'
import NotFoundPage from '../components/NotFoundPage'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'RYKA CORE 4.4 Personal Access | Muhammad Rafi Priyo',
      },
      {
        name: 'description',
        content: 'RYKA CORE 4.4 with personal needs setup, alternative input, stable core vocabulary, partner display, low-tech fallback, privacy controls, live captions, gesture-to-text, and secure MediaPipe hand tracking.',
      },
      {
        httpEquiv: 'Content-Security-Policy',
        content: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' http://127.0.0.1:3210 http://localhost:3210 ws://127.0.0.1:3200 ws://localhost:3200 https://cdn.jsdelivr.net https://storage.googleapis.com;",
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme) {
                    theme = JSON.parse(theme);
                  }
                  document.documentElement.classList.add(theme || 'dark');
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 antialiased transition-colors duration-300">
        <ThemeProvider>
          <LenisSmoothScrollProvider />
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: 'var(--toast-bg)',
                color: 'var(--toast-color)',
                border: '1px solid var(--toast-border)',
                borderRadius: '0px',
                fontSize: '13px',
                fontFamily: 'monospace',
              },
              success: {
                iconTheme: {
                  primary: '#38bdf8',
                  secondary: '#fff',
                },
              },
            }}
          />
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

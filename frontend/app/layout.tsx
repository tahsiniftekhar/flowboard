import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const description =
  'Shared Kanban boards: Next.js client and a NestJS, Prisma and Postgres API with board-scoped access and card order that holds under concurrent drags.';

export const metadata: Metadata = {
  metadataBase: new URL('https://flowboard.tahsiniftekhar.com'),
  title: 'Flowboard',
  description,
  openGraph: {
    title: 'Flowboard',
    description,
    url: '/',
    siteName: 'Flowboard',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowboard',
    description,
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem('flowboard_theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

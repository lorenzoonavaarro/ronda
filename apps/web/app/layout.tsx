import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { cn } from '@repo/ui/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Ronda',
  description: 'A rotating savings group.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen antialiased">
        <ClerkProvider appearance={{ theme: shadcn }} afterSignOutUrl="/">
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

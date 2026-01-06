import './globals.css';
import { AppProvider } from '../context/context';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'jotai';

export const metadata = {
  title: 'DebaTube',
  description: 'Created for Competitive Debaters',
};


import { ThemeProvider } from '../components/theme-provider';



export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="jp" suppressHydrationWarning>
      <body>
        <Provider>
          <Toaster position="top-right" />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
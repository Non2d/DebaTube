import './globals.css';
import { AppProvider } from '../context/context';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'jotai';

export const metadata = {
  title: 'DebaTube',
  description: 'Created for Competitive Debaters',
};

import { LanguageProvider } from '../context/LanguageContext';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="jp">
      <body>
        <Provider>
          <Toaster position="top-right" />
          <LanguageProvider>
            <AppProvider>
              {children}
            </AppProvider>
          </LanguageProvider>
        </Provider>
      </body>
    </html>
  );
}
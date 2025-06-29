import './globals.css';
import { AppProvider } from '../context/context';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'jotai';

export const metadata = {
  title: 'DebaTube',
  description: 'Created for Competitive Debaters',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="jp">
      <body>
        <Provider>
          <Toaster position="top-right" />
          <AppProvider>
            {children}
          </AppProvider>
        </Provider>
      </body>
    </html>
  );
}
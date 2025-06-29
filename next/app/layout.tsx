import './globals.css';
import { AppProvider } from '../context/context'; // コンテキストファイルのパスに応じて変更
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'DebaTube',
  description: 'Created for Competitive Debaters',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="jp">
      <body>
        <Toaster position="top-right" />
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
import './globals.css';
import { AppProvider } from '../context/context'; // コンテキストファイルのパスに応じて変更
import { ReactNode } from 'react';
import Header from '../components/utils/Header';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Debate Structure Visualizer',
  description: 'Created for Competitive Debaters',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="jp">
      <body>
        <Header />
        <Toaster position="top-right" />
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
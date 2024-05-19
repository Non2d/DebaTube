// import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Registraition Page',
}

export default function Layout({ children }) {
  return (
    <div>
      <Toaster />
      {children}
    </div>
  );
}
export const metadata = {
  title: 'Dashboard',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {children}
    </div>
  );
}
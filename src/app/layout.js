import { Rubik, Roboto } from 'next/font/google';
import AppShell from '@/components/AppShell';
import './globals.css';

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-rubik',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata = {
  title: 'Estoque de Discos | Freelancer Discos',
  description: 'Sistema de gerenciamento de estoque de discos de vinil, CDs e DVDs',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${rubik.variable} ${roboto.variable}`} data-theme="dark">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

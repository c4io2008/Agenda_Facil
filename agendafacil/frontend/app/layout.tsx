import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AgendaFácil — agenda online para o seu negócio',
  description: 'Seus clientes agendam sozinhos, 24 horas por dia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

import './globals.css';

export const metadata = {
  title: 'MeuBESS · Financeiro — Gestão de Contas',
  description: 'Dashboards do departamento financeiro da MeuBESS.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

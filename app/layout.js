import './globals.css';
import MenuTopo from './menu-topo.js';

export const metadata = {
  title: 'MeuBESS · Financeiro — Gestão de Contas',
  description: 'Dashboards do departamento financeiro da MeuBESS.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <MenuTopo />
        {children}
      </body>
    </html>
  );
}

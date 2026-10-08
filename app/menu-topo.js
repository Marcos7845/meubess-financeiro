'use client';
// O MENU DO TOPO — uma cápsula flutuante, centralizada, com a "lâmpada" que desliza até o item ativo (pedido do dono,
// 08/10/2026, a partir do modelo "tubelight navbar").
//
// O QUE VEIO DO MODELO: a cápsula com fundo de vidro, o item ativo com fundo suave e a luz no alto dele, que desliza
// entre os itens, e os ícones no lugar do texto em tela estreita (abaixo de 768 px a cápsula também desce para o pé da
// tela, como no modelo). O QUE NÃO VEIO: framer-motion, lucide-react e Tailwind. O deslizar é uma `transition` de CSS
// sobre `transform`: os itens têm a mesma largura (grade de colunas `1fr`), então a lâmpada fica em
// `translateX(--i * 100%)` e não precisa medir nada no navegador. Os ícones são SVG escritos aqui. Cores e medidas
// moram em `app/globals.css`; este arquivo só diz qual item está ativo.
//
// COMPONENTE DE NAVEGADOR, mas só do menu — as telas continuam de servidor, e nenhum gráfico ou número passa por aqui.
// Ele mora no layout raiz (`app/layout.js`), que não é remontado quando se troca de tela: por isso a lâmpada desliga
// de um item para o outro em vez de reaparecer. Chega inteiro no HTML do servidor, com o item certo já aceso.
//
// O ITEM ATIVO SEGUE A ROTA (`usePathname`): abrir a URL direto, o botão voltar do navegador e o clique caem na mesma
// conta. No clique a lâmpada anda já, sem esperar a tela nova chegar do servidor; quando a rota muda, vale a rota.
//
// O QUE ATRAVESSA O MENU. Ano, mês, empresa, conta, unidade e a chave do Omie — os filtros que valem em mais de uma
// tela, e que trocar de tela não pode desfazer (nem religar o Omie). Os outros filtros são de uma tela só e ficam nela.
//
// Não há item para a Gestão de Contas (`/gestao-de-contas`) nem para Centro de Custo (que era só um filtro): saíram do
// menu em 08/10/2026. A Gestão de Contas segue no ar, pelo endereço.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const traco = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Icone = ({ children }) => (
  <svg className="menu-icone" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" {...traco}>
    {children}
  </svg>
);

// A ordem é a do menu. `leva` diz se o item recebe os filtros que atravessam as telas.
const ITENS = [
  {
    rota: '/fluxo-de-caixa', nome: 'Fluxo de Caixa', leva: true,
    icone: <Icone><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></Icone>,
  },
  {
    rota: '/dre', nome: 'DRE', leva: true,
    icone: <Icone><path d="M3 3v18h18" /><path d="M8 17v-5" /><path d="M13 17V8" /><path d="M18 17v-9" /></Icone>,
  },
  {
    rota: '/pendencias', nome: 'Pendências', leva: false,
    icone: <Icone><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icone>,
  },
];

const QUE_ATRAVESSAM = ['ano', 'mes', 'empresa', 'conta', 'unidade', 'omie'];

const itemDe = (caminho) => ITENS.findIndex((i) => caminho === i.rota || caminho.startsWith(`${i.rota}/`));

function Capsula({ filtros }) {
  const caminho = usePathname();
  // O item clicado, até a rota nova chegar. Quando a rota muda, ele é largado e vale a rota.
  const [clicado, setClicado] = useState(null);
  useEffect(() => { setClicado(null); }, [caminho]);
  const ativo = clicado ?? itemDe(caminho);

  return (
    <nav className="menu-topo" aria-label="Telas do portal">
      <div className="menu-trilho" style={{ '--n': ITENS.length, '--i': Math.max(ativo, 0) }} data-sem-ativo={ativo < 0 ? '' : undefined}>
        <span className="menu-lampada" aria-hidden="true"><span className="menu-luz" /></span>
        {ITENS.map((item, i) => (
          <Link
            key={item.rota}
            href={item.leva && filtros ? `${item.rota}?${filtros}` : item.rota}
            prefetch={false}
            className={`menu-item${i === ativo ? ' ativo' : ''}`}
            aria-current={i === itemDe(caminho) ? 'page' : undefined}
            aria-label={item.nome}
            onClick={() => setClicado(i)}
          >
            {item.icone}
            <span className="menu-rotulo">{item.nome}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ComFiltros() {
  const q = useSearchParams();
  const leva = new URLSearchParams();
  for (const k of QUE_ATRAVESSAM) if (q.get(k)) leva.set(k, q.get(k));
  return <Capsula filtros={leva.toString()} />;
}

export default function MenuTopo() {
  // Na tela de entrar ainda não há quem navegue.
  if (usePathname() === '/entrar') return null;
  // `useSearchParams` pede um limite de suspensão; sem os filtros, a cápsula é a mesma.
  return <Suspense fallback={<Capsula filtros="" />}><ComFiltros /></Suspense>;
}

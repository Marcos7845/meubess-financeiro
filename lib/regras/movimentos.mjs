// O RECORTE DA MEUBESS E OS TRÊS BALDES — a fonte única dessas regras.
//
// Saiu de `scripts/numeros-das-telas.mjs` quando o app começou. O script da conferência e a camada de dados do app
// chamam `criarRegras()` e usam o MESMO `contar`: é o que garante que a tela e a conferência filtram igual.
//
// Tudo aqui está escrito em `docs/fontes.md`. Nada é heurística.

import fs from 'node:fs';
import path from 'node:path';

// AS CATEGORIAS DE TRANSFERÊNCIA QUE FICAM FORA (decisão do dono, 25/09/2026, opção B). Duas o cadastro marca
// (`transferencia = "S"`); as de baixo se chamam "Transferência" sem a marca. A `1.04.97` só na empresa 1 — na 2 o
// mesmo código é "Prêmios de Seguros / Sinistros" e conta como outra receita.
const TRANSFERENCIA_SEM_MARCA = { 1: ['1.04.96', '1.04.97', '2.05.98'], 2: ['1.04.96', '2.05.98'] };

// O RECORTE DA MEUBESS (decisão do dono, 24 e 25/09/2026): só os lançamentos cuja conta corrente é da MeuBESS.
// Conta que o dono não citou fica fora, e o código não adivinha pelo nome do banco.
function lerRecorte(raiz) {
  return new Set(JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'contas-correntes-por-negocio.json'), 'utf8'))
    .contas.filter((c) => c.negocio === 'MeuBESS').map((c) => c.chave));
}

// `movimentos` e `categorias` são o que o cache devolveu; `recorte`, o conjunto acima.
function criarRegras({ movimentos, categorias, recorte }) {
  const eTransferencia = (emp, cod) =>
    categorias[emp].get(String(cod))?.transferencia === 'S' || TRANSFERENCIA_SEM_MARCA[emp].includes(String(cod));

  // A BASE DE UM PERÍODO: os lançamentos da leitura que sobrevivem ao recorte, ao cancelado e à data. O par do
  // adiantamento ao fornecedor (decisão do dono, 25/09/2026, opção A) é medido DENTRO do período, porque é dentro dele
  // que a tela lê: ficam fora todo lançamento com `cOrigem = "ADCR"` e todo lançamento de um título que tenha, na mesma
  // leitura, alguma linha com `cOrigem = "ADCP"` — o título da ida E a baixa dele.
  function base(emp, dentro) {
    const linhas = movimentos[emp].map((m) => ({ ...m.detalhes, _resumo: m.resumo ?? {} }))
      .filter((d) => d.cStatus !== 'CANCELADO' && recorte.has(`${emp}|${d.nCodCC}`) && dentro(d.dDtPagamento));
    const adcp = new Set(linhas.filter((d) => d.cOrigem === 'ADCP' && d.nCodTitulo).map((d) => d.nCodTitulo));
    const elegivel = (d) => d.cOrigem !== 'ADCR' && !(d.nCodTitulo && adcp.has(d.nCodTitulo));
    return { linhas, adcp, elegivel };
  }

  // OS TRÊS BALDES, SEM CONTAR DUAS VEZES. O título baixado volta na mesma leitura como CONTA_A_PAGAR / CONTA_A_RECEBER
  // e como CONTA_CORRENTE_PAG / CONTA_CORRENTE_REC com o mesmo `nCodTitulo`; fica o título, um por `nCodTitulo`, e do
  // conta corrente entram os dois que não têm título irmão nesta leitura, cada um uma vez por `nCodMovCC`: o AVULSO
  // (`nCodTitulo` 0) e a BAIXA DO TÍTULO QUITADO SÓ EM PARTE (`nCodTitulo` preenchido, título ausente da leitura).
  function baldes(b, nat, extra = () => true) {
    const titulos = new Map(), baixas = new Map(), avulsos = new Map();
    for (const d of b.linhas) {
      if (d.cNatureza !== nat) continue;
      if (!b.elegivel(d)) continue;
      if (!extra(d)) continue;
      if (d.cGrupo === 'CONTA_A_RECEBER' || d.cGrupo === 'CONTA_A_PAGAR') titulos.set(d.nCodTitulo, d);
      else if (d.cGrupo === 'CONTA_CORRENTE_REC' || d.cGrupo === 'CONTA_CORRENTE_PAG') (d.nCodTitulo ? baixas : avulsos).set(d.nCodMovCC, d);
    }
    for (const [mov, d] of baixas) if (titulos.has(d.nCodTitulo)) baixas.delete(mov);
    return {
      titulos, baixas, avulsos, total: titulos.size + baixas.size + avulsos.size,
      todos: [...titulos.values(), ...baixas.values(), ...avulsos.values()],
    };
  }

  // `comTransferencia` diz se a linha tira as categorias de transferência; `categoria` é a lista de códigos da linha.
  function contar(emp, dentro, nat, { categoria = null, comTransferencia = true } = {}) {
    const b = base(emp, dentro);
    return baldes(b, nat, (d) => (!comTransferencia || !eTransferencia(emp, d.cCodCateg)) && (!categoria || categoria(String(d.cCodCateg ?? ''), d)));
  }

  return { eTransferencia, base, baldes, contar };
}

export { TRANSFERENCIA_SEM_MARCA, lerRecorte, criarRegras };

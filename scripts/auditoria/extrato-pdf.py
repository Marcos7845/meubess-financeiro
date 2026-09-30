# Converte um extrato bancário em PDF (cópia local da master) no CSV que o auditor lê: data;valor;saldo;id;historico.
# Só grava se cada saldo impresso no PDF for igual ao saldo refeito transação a transação; senão para e diz onde.
# Ao lado do CSV grava um .json com a prova da conversão (sem valores nem nomes): contagens, período coberto,
# saldos conferidos e o que foi excluído (depósito bloqueado, por exemplo).
#
#   python scripts/auditoria/extrato-pdf.py --modelo itau --mes 2026-08 --conta "ITAU--1" --pdf <cópia local do PDF>
#
# Requer PyMuPDF (pymupdf). O PDF deve estar em .cache/, nunca na pasta sincronizada.
import argparse, json, os, re, sys
import pymupdf

ap = argparse.ArgumentParser()
ap.add_argument('--modelo', required=True, choices=['itau', 'bb', 'santander'])
ap.add_argument('--mes', required=True)
ap.add_argument('--conta', required=True)
ap.add_argument('--pdf', required=True)
ap.add_argument('--saida', default=os.path.join(os.path.dirname(__file__), '..', '..', 'extratos'))
a = ap.parse_args()

DATA = re.compile(r'\d{2}/\d{2}/\d{4}$')
DINHEIRO = re.compile(r'-?[\d.]+,\d{2}$')
cent = lambda s: int(round(float(s.replace('.', '').replace(',', '.')) * 100))
iso = lambda d: f'{d[6:10]}-{d[3:5]}-{d[0:2]}'
doc = pymupdf.open(a.pdf)
titular = re.search(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', doc[0].get_text())


def linhas(x_data, x_valor, x_saldo, tol=2.5):
    """Cada palavra de data na coluna da data ancora uma linha; valor e saldo são as palavras na mesma altura."""
    for p in doc:
        ws = p.get_text('words')
        for w in ws:
            if w[0] >= x_data or not DATA.match(w[4]):
                continue
            mesma = sorted([v for v in ws if abs(v[1] - w[1]) < tol and v is not w], key=lambda v: v[0])
            texto = ' '.join(v[4] for v in mesma if not DINHEIRO.match(v[4]))
            valor = [v[4] for v in mesma if x_valor[0] <= v[0] < x_valor[1] and DINHEIRO.match(v[4])]
            saldo = [v[4] for v in mesma if v[0] >= x_saldo and DINHEIRO.match(v[4])]
            yield w[4], texto, valor[0] if valor else None, saldo[0] if saldo else None


def falhar(msg):
    print(f'extrato-pdf: {msg}; nada gravado', file=sys.stderr)
    sys.exit(1)


tx, pontos, excluidos = [], 0, {}
if a.modelo == 'itau':
    # Itaú Empresas: SALDO ANTERIOR abre, uma linha por lançamento com data e valor, e "SALDO TOTAL DISPONÍVEL DIA"
    # fecha cada dia com o saldo. Os saldos do dia são os pontos de conferência.
    saldo = abertura = None
    for d, texto, valor, s in linhas(80, (430, 512), 512):
        if texto.startswith('SALDO ANTERIOR'):
            saldo = abertura = cent(s)
            continue
        if saldo is None or d[3:10] != f'{a.mes[5:]}/{a.mes[:4]}':
            continue
        if texto.startswith('SALDO TOTAL'):
            if s is None or cent(s) != saldo:
                falhar(f'saldo do dia {d} não fecha com as transações')
            pontos += 1
            continue
        if valor is None:
            falhar(f'linha de {d} sem valor')
        saldo += cent(valor)
        tx.append((iso(d), cent(valor), saldo, texto))
    fechamento = saldo
elif a.modelo == 'bb':
    # Banco do Brasil, extrato de conta corrente: "Saldo Anterior" e "S A L D O" com o saldo; depósito bloqueado ("*")
    # não é saldo disponível e fica fora, contado em `excluidos`.
    saldo = abertura = fechamento = None
    for d, texto, valor, s in linhas(110, (440, 512), 518):
        if 'Saldo Anterior' in texto:
            saldo = abertura = cent(s)
            continue
        if texto.replace(' ', '').endswith('SALDO') or 'S A L D O' in texto:
            fechamento = cent(s)
            pontos += 1
            continue
        if 'bloquead' in texto:
            excluidos['deposito bloqueado'] = excluidos.get('deposito bloqueado', 0) + 1
            continue
        if valor is None:
            falhar(f'linha de {d} sem valor')
        saldo += cent(valor)
        tx.append((iso(d), cent(valor), saldo, texto))
    if saldo != fechamento:
        falhar('saldo final não fecha com as transações')
else:
    # Santander Empresas: mais recente primeiro, cada linha com o saldo após ela. Refaz em ordem cronológica e confere
    # linha a linha (saldo anterior + valor = saldo).
    brutas = [(iso(d), cent(v), cent(s), t) for d, t, v, s in linhas(80, (420, 500), 500) if v and s]
    brutas.reverse()
    if not brutas:
        falhar('nenhuma transação')
    abertura = brutas[0][2] - brutas[0][1]
    anterior = abertura
    for data, v, s, historico in brutas:
        if anterior + v != s:
            falhar(f'saldo de {data} não fecha')
        pontos += 1
        anterior = s
        if data[:7] == a.mes:
            tx.append((data, v, s, historico))
    fechamento = tx[-1][2] if tx else None

if not tx and fechamento is None:
    falhar('sem transação nem saldo no mês')
datas = [t[0] for t in tx]
texto = doc[0].get_text()
periodo = re.search(r'(\d{2}/\d{2}/\d{4})\s*(?:a|at.)\s*(\d{2}/\d{2}/\d{4})', texto)
inicio = iso(periodo.group(1)) if periodo else (min(datas) if datas else None)
fim = iso(periodo.group(2)) if periodo else (max(datas) if datas else None)
if a.modelo == 'bb':
    inicio, fim = f'{a.mes}-01', f'{a.mes}-31'
os.makedirs(a.saida, exist_ok=True)
base = os.path.join(a.saida, f'{a.mes}__{a.conta}')
with open(base + '.csv', 'w', encoding='utf-8', newline='\n') as f:
    f.write('data;valor;saldo;id;historico\n')
    if not tx:
        f.write(f'{a.mes}-{fim[8:10]};0.00;{fechamento / 100:.2f};saldo\n')
    for i, (d, v, s, historico) in enumerate(tx):
        historico = ' '.join(historico.replace(';', ' ').replace('"', ' ').split())
        f.write(f'{d};{v / 100:.2f};{s / 100:.2f};pdf-{i + 1};{historico}\n')
ultimo = int(fim[8:10]) if fim else 0
prova = {
    'pdf': os.path.basename(a.pdf), 'modelo': a.modelo, 'conta': a.conta, 'mes': a.mes,
    'transacoes': len(tx), 'saldosConferidos': pontos, 'excluidos': excluidos,
    'cnpjDoTitular': titular.group(0) if titular else None, 'periodoDoPdf': [inicio, fim],
    'cobreMesInteiro': bool(inicio and fim and inicio <= f'{a.mes}-01' and fim[:7] >= a.mes and (fim[:7] > a.mes or ultimo >= 28)),
}
with open(base + '.json', 'w', encoding='utf-8') as f:
    json.dump(prova, f, ensure_ascii=False, indent=1)
print(f'{a.conta}: {len(tx)} transações, {pontos} saldos conferidos, excluídos {excluidos or "nenhum"}, mês inteiro: {prova["cobreMesInteiro"]}')

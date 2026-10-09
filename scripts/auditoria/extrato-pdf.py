# Converte um extrato bancário em PDF (cópia local da master) no CSV que o auditor lê: data;valor;saldo;id;historico.
# Só grava se cada saldo impresso no PDF for igual ao saldo refeito transação a transação; senão para e diz onde.
# Ao lado do CSV grava um .json com a prova da conversão (sem valores nem nomes): contagens, período coberto,
# saldos conferidos e o que foi excluído (depósito bloqueado, por exemplo).
#
#   python scripts/auditoria/extrato-pdf.py --modelo itau --mes 2026-08 --conta "ITAU--1" --pdf <cópia local do PDF>
#
# Modelos: itau, bb, santander, stone ("Extrato de conta corrente" da Stone em PDF; o xlsx do "Comprovante de Extrato"
# tem o seu conversor, extrato-stone.mjs), safra ("Extrato de Movimentação" do Safra, conta do DFC da 3N) e sicoob
# ("Extrato de conta corrente" do Sicoob/SISBR, conta do DFC da B3N). Os CSV das unidades separadas vão para
# extratos/<UNIDADE>/ (--saida), para não entrarem na conciliação do DFC B3W.
#
# Requer PyMuPDF (pymupdf). O PDF deve estar em .cache/, nunca na pasta sincronizada.
import argparse, json, os, re, sys
import pymupdf

ap = argparse.ArgumentParser()
ap.add_argument('--modelo', required=True, choices=['itau', 'bb', 'santander', 'stone', 'safra', 'sicoob'])
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


def linhas_stone():
    """Extrato de conta da Stone: mais recente primeiro; por lançamento, em linhas de texto: data (dd/mm/aa), tipo,
    descrição, valor ("R$ 1,00" ou "- R$ 1,00"), saldo e contraparte. Entrega (data, texto, valor, saldo) como `linhas`."""
    dt, dinheiro = re.compile(r'\d{2}/\d{2}/\d{2}$'), re.compile(r'(-\s*)?R\$\s*[\d.]+,\d{2}$')
    cabecalho = re.compile(r'(DATA|TIPO|DESCRIÇÃO|VALOR|SALDO|CONTRAPARTE|Extrato de conta corrente|Emitido em .*|Página \d+ de \d+)$')
    atual = None
    for p in doc:
        for linha in (l.strip() for l in p.get_text().split('\n')):
            if linha.startswith('Informações do Comprovante'):
                break
            if dt.match(linha):
                if atual:
                    yield atual
                atual = {'d': linha[:6] + '20' + linha[6:], 'texto': [], 'dinheiro': []}
            elif atual is None or cabecalho.match(linha):
                continue
            elif dinheiro.match(linha):
                atual['dinheiro'].append(linha)
            elif not atual['dinheiro']:
                atual['texto'].append(linha)
    if atual:
        yield atual


def lancamentos_stone():
    for l in linhas_stone():
        if len(l['dinheiro']) != 2:
            falhar(f'lançamento de {l["d"]} sem valor e saldo')
        yield l['d'], ' '.join(l['texto']), l['dinheiro'][0].replace(' ', '').replace('R$', ''), l['dinheiro'][1].replace(' ', '').replace('R$', '')


def registros(dt, fim_de_registro, inicio=None, pula=None):
    """Extratos em que cada lançamento é uma sequência de linhas de texto que começa pela data (dd/mm) e termina no
    valor. Entrega (data dd/mm, linhas de texto, valor). `inicio` é a linha que abre a lista; `pula`, rodapé que fecha
    um registro aberto sem valor (a quebra de página)."""
    aberto, atual = inicio is None, None
    for p in doc:
        for linha in (l.strip() for l in p.get_text().split('\n')):
            if not aberto:
                aberto = linha.startswith(inicio)
                continue
            if pula and pula.match(linha):
                atual = None
                continue
            if dt.match(linha):
                if atual:
                    falhar(f'lançamento de {atual[0]} sem valor')
                atual = [linha, []]
                continue
            if atual is None:
                continue
            v = fim_de_registro.match(linha)
            if v:
                yield atual[0], atual[1], v
                atual = None
            else:
                atual[1].append(linha)
    if atual:
        falhar(f'lançamento de {atual[0]} sem valor')


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
elif a.modelo == 'safra':
    # Safra, "Extrato de Movimentação": ordem cronológica; cada lançamento é data, lançamento, complemento, documento e
    # valor assinado; "SALDO TOTAL" fecha cada dia com o saldo. O primeiro SALDO TOTAL dá a abertura (menos o que veio
    # antes dele no mesmo dia); os seguintes são os pontos de conferência.
    ano = a.mes[:4]
    saldo = abertura = None
    antes = []
    for d, texto, v in registros(re.compile(r'\d{2}/\d{2}$'), re.compile(r'(-?[\d.]+,\d{2})$'),
                                 inicio='LANÇAMENTOS REALIZADOS', pula=re.compile(r'Banco Safra S/A')):
        data, valor = f'{ano}-{d[3:5]}-{d[0:2]}', cent(v.group(1))
        if texto and texto[0].startswith('SALDO TOTAL'):
            if saldo is None:
                abertura = valor - sum(x[1] for x in antes)
                saldo = abertura
                for x in antes:
                    saldo += x[1]
                    tx.append((x[0], x[1], saldo, x[2]))
            elif valor != saldo:
                falhar(f'saldo do dia {d} não fecha com as transações')
            else:
                pontos += 1
            continue
        if saldo is None:
            antes.append((data, valor, ' '.join(texto)))
            continue
        saldo += valor
        tx.append((data, valor, saldo, ' '.join(texto)))
    if saldo is None:
        falhar('sem SALDO TOTAL')
    fechamento = saldo
    tx = [t for t in tx if t[0][:7] == a.mes]
elif a.modelo == 'sicoob':
    # Sicoob (SISBR), "Extrato de conta corrente": do mais recente ao mais antigo; cada dia traz os lançamentos e
    # termina em "SALDO DO DIA"; "SALDO ANTERIOR" (último do arquivo) é a abertura. Valor "R$ 1,00C" (crédito) ou
    # "R$ 1,00D" (débito); "SALDO BLOQUEADO ANTERIOR" (marca "*") fica fora, contado em `excluidos`. A ordem dentro do dia
    # não é garantida pelo PDF: o saldo de cada transação é refeito na ordem inversa da impressa, e só o saldo do dia é
    # conferido.
    ano = a.mes[:4]
    dias, movs, abertura = [], [], None
    for d, texto, v in registros(re.compile(r'\d{2}/\d{2}$'), re.compile(r'R\$\s*([\d.]+,\d{2})([CD*])$')):
        data, valor = f'{ano}-{d[3:5]}-{d[0:2]}', cent(v.group(1)) * (-1 if v.group(2) == 'D' else 1)
        rotulo = texto[-1] if texto else ''
        if v.group(2) == '*' or 'SALDO BLOQUEADO' in ' '.join(texto):
            excluidos['saldo bloqueado'] = excluidos.get('saldo bloqueado', 0) + 1
            continue
        if rotulo == 'SALDO ANTERIOR':
            abertura = valor
            continue
        if rotulo == 'SALDO DO DIA':
            dias.append((data, movs, valor))
            movs = []
            continue
        movs.append((data, valor, ' '.join(texto)))
    if movs:
        falhar('lançamentos depois do último SALDO DO DIA')
    if abertura is None:
        falhar('sem SALDO ANTERIOR')
    saldo = abertura
    for data, ms, fim_do_dia in reversed(dias):
        for d, valor, historico in reversed(ms):
            if d != data:
                falhar(f'lançamento de {d} no dia {data}')
            saldo += valor
            tx.append((d, valor, saldo, historico))
        if saldo != fim_do_dia:
            falhar(f'saldo do dia {data} não fecha com as transações')
        pontos += 1
    fechamento = saldo
    tx = [t for t in tx if t[0][:7] == a.mes]
else:
    # Santander Empresas e Stone: mais recente primeiro, cada linha com o saldo após ela. Refaz em ordem cronológica e confere
    # linha a linha (saldo anterior + valor = saldo).
    origem = lancamentos_stone() if a.modelo == 'stone' else linhas(80, (420, 500), 500)
    brutas = [(iso(d), cent(v), cent(s), t) for d, t, v, s in origem if v and s]
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
periodo = re.search(r'(\d{2}/\d{2}/\d{4})\s*(?:a|at.%s)\s*(\d{2}/\d{2}/\d{4})' % ('|-' if a.modelo == 'sicoob' else ''), texto)
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
# Período que começa depois do dia 1 só porque os primeiros dias do mês são sábado e domingo (o Safra de agosto/2026
# abre em 03/08, segunda-feira) cobre o mês: sem dia útil antes, não há lançamento a perder. Fica anotado na prova.
inicio_util = inicio
if inicio and inicio[:7] == a.mes and inicio > f'{a.mes}-01':
    import datetime
    d0 = datetime.date(int(a.mes[:4]), int(a.mes[5:7]), 1)
    if all((d0 + datetime.timedelta(days=i)).weekday() >= 5 for i in range(int(inicio[8:10]) - 1)):
        inicio_util = f'{a.mes}-01'
prova = {
    'pdf': os.path.basename(a.pdf), 'modelo': a.modelo, 'conta': a.conta, 'mes': a.mes,
    'transacoes': len(tx), 'saldosConferidos': pontos, 'excluidos': excluidos,
    'cnpjDoTitular': titular.group(0) if titular else None, 'periodoDoPdf': [inicio, fim],
    'inicioNoFimDeSemana': inicio_util != inicio,
    'cobreMesInteiro': bool(inicio_util and fim and inicio_util <= f'{a.mes}-01' and fim[:7] >= a.mes and (fim[:7] > a.mes or ultimo >= 28)),
}
with open(base + '.json', 'w', encoding='utf-8') as f:
    json.dump(prova, f, ensure_ascii=False, indent=1)
print(f'{a.conta}: {len(tx)} transações, {pontos} saldos conferidos, excluídos {excluidos or "nenhum"}, mês inteiro: {prova["cobreMesInteiro"]}')

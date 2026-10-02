"""Extrai o Anexo I da CCB local por posição das colunas; só escreve JSON em stdout."""
import json
import re
import sys

import pymupdf


def centavos(texto):
    return int(round(float(texto.replace('.', '').replace(',', '.')) * 100))


def ler(arquivo):
    parcelas = []
    with pymupdf.open(arquivo) as pdf:
        for pagina in pdf:
            palavras = pagina.get_text('words')
            datas = [(x, y, t) for x, y, _, _, t, *_ in palavras if re.fullmatch(r'\d{2}/\d{2}/\d{4}', t)]
            for _, y, data in datas:
                mesma = [(x, t) for x, yy, _, _, t, *_ in palavras if abs(yy - y) < 4]
                numero = next((int(t) for x, t in mesma if x < 70 and re.fullmatch(r'\d{1,2}', t)), None)
                if numero is None:
                    continue
                colunas = []
                for minimo, maximo in ((160, 280), (290, 415), (420, 600)):
                    valor = next((t for x, t in mesma if minimo <= x < maximo and re.fullmatch(r'[\d.]+,\d{2}', t)), None)
                    colunas.append(centavos(valor) if valor else None)
                if any(v is None for v in colunas):
                    continue
                juros, principal, total = colunas
                if juros + principal != total:
                    raise ValueError(f'parcela {numero}: colunas não fecham')
                dia, mes, ano = map(int, data.split('/'))
                parcelas.append(dict(n=numero, venc=f'{ano:04d}-{mes:02d}-{dia:02d}', juros=juros,
                                     principal=principal, total=total))
    parcelas.sort(key=lambda p: p['n'])
    if len(parcelas) != 57 or [p['n'] for p in parcelas] != list(range(1, 58)):
        raise ValueError('Anexo I incompleto ou com parcelas repetidas')
    return parcelas


if __name__ == '__main__':
    print(json.dumps(ler(sys.argv[1]), separators=(',', ':')))

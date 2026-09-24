#!/usr/bin/env node
// Lê a ESTRUTURA das planilhas de fluxo de caixa (DFC) de 2026 — só leitura, nunca grava.
//
// A pasta é a do SharePoint do financeiro sincronizada pelo OneDrive neste computador
// (a pasta DFC/2026). O caminho não fica escrito aqui: o script procura, dentro da raiz
// sincronizada, a única subpasta terminada em "2026". Dá para apontar outra com a variável
// de ambiente DFC_DIR ou com o primeiro argumento.
//
// O que ele imprime: abas de cada arquivo, dimensão, cabeçalhos, os rótulos das linhas
// (as contas do DFC) e quantas células de número cada linha/aba tem.
// O que ele NUNCA imprime: valor de célula numérica. Só a contagem.
//
//   node scripts/estrutura-dfc.mjs               # todos os 12 arquivos, resumo
//   node scripts/estrutura-dfc.mjs --detalhe     # com os rótulos de cada linha
//   node scripts/estrutura-dfc.mjs --arquivo 01  # só o arquivo que começa com "01"
//   node scripts/estrutura-dfc.mjs --aba BASE     # só a aba cujo nome começa assim
//   node scripts/estrutura-dfc.mjs --colunas A,I,J  # os valores de texto distintos dessas colunas
//                                                   (para ler o vocabulário de classificação — não use
//                                                    nas colunas de nome de pessoa ou empresa)
//   node scripts/estrutura-dfc.mjs --meses F        # em que ano-mês caem as datas dessa coluna
//                                                   (só o ano-mês sai; o dia e o valor, não)

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

// ---------------------------------------------------------------- zip (xlsx é um zip)

function lerZip(buf) {
  const eocdSig = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === eocdSig) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('não é um zip (EOCD não encontrado)')
  const total = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const arquivos = new Map()
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const metodo = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nomeLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const comentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const nome = buf.toString('utf8', p + 46, p + 46 + nomeLen)
    arquivos.set(nome, { metodo, compSize, offset })
    p += 46 + nomeLen + extraLen + comentLen
  }
  return {
    nomes: [...arquivos.keys()],
    ler(nome) {
      const e = arquivos.get(nome)
      if (!e) return null
      const lh = e.offset
      if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('cabeçalho local inválido: ' + nome)
      const ini = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28)
      const cru = buf.subarray(ini, ini + e.compSize)
      return e.metodo === 0 ? cru : zlib.inflateRawSync(cru)
    },
  }
}

// ---------------------------------------------------------------- xml (o mínimo)

function desescapar(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&')
}

function textoDosT(xml) {
  const out = []
  const re = /<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g
  let m
  while ((m = re.exec(xml))) out.push(m[1] ? desescapar(m[1]) : '')
  return out.join('')
}

function sharedStrings(zip) {
  const b = zip.ler('xl/sharedStrings.xml')
  if (!b) return []
  const xml = b.toString('utf8')
  const out = []
  const re = /<si>([\s\S]*?)<\/si>|<si\/>/g
  let m
  while ((m = re.exec(xml))) out.push(m[1] ? textoDosT(m[1]) : '')
  return out
}

function abas(zip) {
  const wb = zip.ler('xl/workbook.xml').toString('utf8')
  const rels = (zip.ler('xl/_rels/workbook.xml.rels') || Buffer.from('')).toString('utf8')
  const alvo = new Map()
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1]
    const t = /Target="([^"]+)"/.exec(m[0])?.[1]
    if (id && t) alvo.set(id, t.replace(/^\/?xl\//, '').replace(/^\.\//, ''))
  }
  const lista = []
  for (const m of wb.matchAll(/<sheet\b[^>]*\/>/g)) {
    const nome = desescapar(/name="([^"]*)"/.exec(m[0])?.[1] ?? '')
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1]
    const estado = /state="([^"]*)"/.exec(m[0])?.[1] ?? 'visible'
    lista.push({ nome, estado, parte: 'xl/' + (alvo.get(rid) ?? '') })
  }
  return lista
}

const colDeRef = (r) => (/^([A-Z]+)/.exec(r)?.[1] ?? '')
const numDeCol = (c) => [...c].reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0)

// Devolve as linhas de uma aba: só texto e contagem de números — nunca o número.
function lerAba(zip, parte, ss) {
  const b = zip.ler(parte)
  if (!b) return null
  const xml = b.toString('utf8')
  const dim = /<dimension[^>]*ref="([^"]+)"/.exec(xml)?.[1] ?? ''
  const mescladas = [...xml.matchAll(/<mergeCell[^>]*ref="([^"]+)"/g)].map((m) => m[1])
  const linhas = []
  for (const mr of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const attrs = mr[1] ?? mr[3] ?? ''
    const corpo = mr[2] ?? ''
    const n = +(/r="(\d+)"/.exec(attrs)?.[1] ?? 0)
    const textos = []   // [coluna, texto]
    const nums = []     // colunas com número
    const serie = []    // [coluna, número] — só o modo --meses olha isto, e só para achar o ano-mês
    let numsNaoZero = 0
    let formulas = 0
    for (const mc of corpo.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const ca = mc[1] ?? mc[3] ?? ''
      const cc = mc[2] ?? ''
      const ref = /r="([A-Z]+\d+)"/.exec(ca)?.[1] ?? ''
      const tipo = /t="([^"]*)"/.exec(ca)?.[1] ?? 'n'
      if (/<f[\s>]/.test(cc) || /<f\/>/.test(cc)) formulas++
      const v = /<v>([\s\S]*?)<\/v>/.exec(cc)?.[1]
      if (tipo === 's') {
        const t = ss[+v] ?? ''
        if (t.trim()) textos.push([colDeRef(ref), t.trim()])
      } else if (tipo === 'inlineStr') {
        const t = textoDosT(cc)
        if (t.trim()) textos.push([colDeRef(ref), t.trim()])
      } else if (tipo === 'str') {
        if (v && desescapar(v).trim()) textos.push([colDeRef(ref), desescapar(v).trim()])
      } else if (v !== undefined && v !== '') {
        nums.push(colDeRef(ref))
        if (Number(v) !== 0) numsNaoZero++   // contagem, não o valor
        serie.push([colDeRef(ref), Number(v)])
      }
    }
    if (textos.length || nums.length) linhas.push({ n, textos, nums, numsNaoZero, formulas, serie })
  }
  return { dim, mescladas, linhas }
}

// ---------------------------------------------------------------- pasta

function acharPasta() {
  if (process.env.DFC_DIR) return process.env.DFC_DIR
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--') && /[\\/]/.test(a))
  if (arg) return arg
  const raizes = [path.join(os.homedir(), 'Meu Bess'), path.join(os.homedir(), 'OneDrive')]
  for (const raiz of raizes) {
    if (!fs.existsSync(raiz)) continue
    // Pasta do OneDrive é reparse point: `Dirent.isDirectory()` devolve false. Usar stat.
    for (const nome of fs.readdirSync(raiz)) {
      if (!/2026\s*$/.test(nome)) continue
      try {
        if (fs.statSync(path.join(raiz, nome)).isDirectory()) return path.join(raiz, nome)
      } catch { /* ignora */ }
    }
  }
  throw new Error('não achei a pasta DFC/2026 sincronizada; use DFC_DIR=<caminho>')
}

// ---------------------------------------------------------------- saída

const detalhe = process.argv.includes('--detalhe')
const opcao = (nome) => {
  const i = process.argv.indexOf(nome)
  return i > 0 ? process.argv[i + 1] : null
}
const filtro = opcao('--arquivo')
const filtroAba = opcao('--aba')
const colunas = (opcao('--colunas') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
const colMes = (opcao('--meses') ?? '').trim().toUpperCase()

// Serial do Excel -> "AAAA-MM". Só o ano-mês sai daqui; o dia e o valor ficam de fora.
function anoMes(serial) {
  if (!(serial > 20000 && serial < 80000)) return null
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const pasta = acharPasta()
const arquivos = fs.readdirSync(pasta)
  .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
  .filter((f) => !filtro || f.startsWith(filtro))
  .sort()

console.log(`pasta DFC/2026 sincronizada — ${arquivos.length} arquivo(s) .xlsx`)
console.log('(só estrutura: rótulos e contagens; nenhum valor de célula numérica é impresso)\n')

for (const arq of arquivos) {
  const zip = lerZip(fs.readFileSync(path.join(pasta, arq)))
  const ss = sharedStrings(zip)
  console.log('='.repeat(78))
  console.log(`ARQUIVO: ${arq}`)
  const lista = abas(zip)
  console.log(`abas (${lista.length}): ${lista.map((a) => a.nome + (a.estado !== 'visible' ? ` [${a.estado}]` : '')).join(' | ')}`)
  for (const aba of lista) {
    if (filtroAba && !aba.nome.trim().toLowerCase().startsWith(filtroAba.trim().toLowerCase())) continue
    const s = lerAba(zip, aba.parte, ss)
    if (!s) { console.log(`  - ${aba.nome}: (parte não encontrada)`); continue }
    const totNums = s.linhas.reduce((a, l) => a + l.nums.length, 0)
    const totNaoZero = s.linhas.reduce((a, l) => a + l.numsNaoZero, 0)
    const totForm = s.linhas.reduce((a, l) => a + l.formulas, 0)
    console.log(`\n  ABA "${aba.nome}" — dim ${s.dim} | linhas com conteúdo: ${s.linhas.length} | células de número: ${totNums} (não-zero: ${totNaoZero}) | fórmulas: ${totForm} | mescladas: ${s.mescladas.length}`)
    if (colMes) {
      const porMes = new Map()
      for (const l of s.linhas) for (const [c, v] of l.serie) {
        if (c !== colMes) continue
        const am = anoMes(v)
        if (am) porMes.set(am, (porMes.get(am) ?? 0) + 1)
      }
      const itens = [...porMes.entries()].sort()
      console.log(`    coluna ${colMes} lida como data — ${itens.reduce((a, b) => a + b[1], 0)} célula(s) em ${itens.length} ano-mês:`)
      for (const [am, q] of itens) console.log(`      ${am}: ${q}`)
      continue
    }
    if (colunas.length) {
      const porCol = new Map(colunas.map((c) => [c, new Map()]))
      for (const l of s.linhas) for (const [c, t] of l.textos) porCol.get(c)?.set(t, (porCol.get(c).get(t) ?? 0) + 1)
      for (const c of colunas) {
        const m = porCol.get(c)
        console.log(`    coluna ${c}: ${m.size} valor(es) de texto distinto(s)`)
        for (const [t, q] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
          console.log(`      ${String(q).padStart(5)}x  ${t}`)
        }
      }
      continue
    }
    if (!detalhe) continue
    for (const l of s.linhas) {
      const cols = l.nums.length
        ? ` [${l.nums.length} núm. em ${l.nums[0]}..${l.nums[l.nums.length - 1]}; não-zero ${l.numsNaoZero}]`
        : ''
      const txt = l.textos.map(([c, t]) => `${c}="${t}"`).join(' ')
      console.log(`    L${String(l.n).padStart(3)} ${txt}${cols}`)
    }
  }
  console.log()
}

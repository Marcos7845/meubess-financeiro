#!/usr/bin/env node
// CRIA UM ADMINISTRADOR NO CADASTRO DO SERVIDOR — o jeito por script de ter o primeiro (o outro é
// `MEUBESS_ADMIN_EMAIL` + `MEUBESS_ADMIN_SENHA` no ambiente, que só vale com o cadastro vazio).
//
//   npm run criar-admin -- dono@empresa.com.br
//
// A senha é pedida no terminal, sem eco (ou vem de `MEUBESS_ADMIN_SENHA`, se estiver no ambiente). Grava no mesmo
// `usuarios.json` que o app lê: `MEUBESS_DADOS_DIR` / o volume do Railway, ou `.cache/servidor` neste computador. No
// Railway, rode dentro do serviço (`railway ssh`), para gravar no volume dele.
// Não imprime a senha nem o hash.

import readline from 'node:readline';
import { criar, SENHA_MINIMA } from '../lib/acesso/usuarios.mjs';
import { pastaDosDados } from '../lib/acesso/armazenamento.mjs';

const email = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!email) { console.error('uso: npm run criar-admin -- email@empresa.com.br'); process.exit(1); }

function perguntarSemEco(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pergunta)) rl.output.write(s); };
    rl.question(pergunta, (r) => { rl.close(); process.stdout.write('\n'); resolve(r); });
  });
}

const senha = process.env.MEUBESS_ADMIN_SENHA || await perguntarSemEco(`senha (pelo menos ${SENHA_MINIMA} caracteres): `);
if (!process.env.MEUBESS_ADMIN_SENHA && senha !== await perguntarSemEco('repita a senha: ')) {
  console.error('as duas senhas não são iguais; nada foi gravado'); process.exit(1);
}
try {
  const p = await criar({ email, senha, admin: true });
  console.log(`administrador ${p.email} criado no cadastro em ${pastaDosDados()}`);
} catch (e) {
  console.error(`não criei: ${e.message}`); process.exit(1);
}

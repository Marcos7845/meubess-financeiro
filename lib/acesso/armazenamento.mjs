// ONDE O SERVIDOR GUARDA O QUE PRECISA SOBREVIVER A UM REDEPLOY — o cadastro de quem entra e o DFC que o PC mandou.
//
// No Railway é o VOLUME montado no serviço: `MEUBESS_DADOS_DIR` aponta para ele e, sem ela, vale o caminho que o
// próprio Railway anuncia em `RAILWAY_VOLUME_MOUNT_PATH`. Neste computador, sem nenhuma das duas, é `.cache/servidor`
// na raiz do repositório — fora do git, como todo o `.cache/`.
//
// Nenhum caminho real e nenhuma credencial entram aqui: o caminho vem do ambiente.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function pastaDosDados() {
  const d = process.env.MEUBESS_DADOS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return d ? path.resolve(d) : path.join(RAIZ, '.cache', 'servidor');
}

export { pastaDosDados, RAIZ };

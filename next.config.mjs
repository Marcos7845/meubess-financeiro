/** @type {import('next').NextConfig} */
const nextConfig = {
  // A camada de dados lê arquivo do disco (o cache do Omie e as planilhas do DFC). Isso só existe no servidor.
  serverExternalPackages: [],

  // ONDE O BUILD É GRAVADO. Por padrão `.next`, como sempre. A variável existe para uma coisa só: construir e subir o
  // código NOVO sem tocar na pasta de onde o app que o dono está usando serve as telas. `next build` reescreve o
  // `.next` inteiro — o `BUILD_ID`, os manifestos e os pedaços de página —, e fazer isso com um `next start` lendo a
  // mesma pasta quebra a tela na cara de quem está com ela aberta.
  //
  //   MEUBESS_DIST=.next-prova node node_modules/next/dist/bin/next build
  //   MEUBESS_DIST=.next-prova node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4782
  //
  // É assim que a captura das três telas é feita a partir do código novo enquanto o app de sempre segue de pé na 4781.
  distDir: process.env.MEUBESS_DIST || '.next',
};
export default nextConfig;

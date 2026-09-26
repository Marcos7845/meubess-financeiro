/** @type {import('next').NextConfig} */
const nextConfig = {
  // A camada de dados lê arquivo do disco (o cache do Omie e as planilhas do DFC). Isso só existe no servidor.
  serverExternalPackages: [],
};
export default nextConfig;

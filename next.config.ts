import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fotos de comprobantes, facturas, contratos, circulares y firmas suben por
      // server action (FormData). El límite del negocio es 20 MB por archivo.
      bodySizeLimit: "25mb",
    },
    // Con proxy (src/proxy.ts) Next guarda el cuerpo del pedido en memoria y por
    // defecto lo corta en 10 MB: un adjunto más grande llegaba truncado.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;

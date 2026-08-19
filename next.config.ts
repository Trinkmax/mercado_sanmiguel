import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fotos de comprobantes, facturas, contratos, circulares y firmas suben por
      // server action (FormData). El límite del negocio es 20 MB por archivo.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

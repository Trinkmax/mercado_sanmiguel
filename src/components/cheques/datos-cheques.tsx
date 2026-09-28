"use client";

import { createContext, useContext, useMemo } from "react";
import type { GastoPendiente } from "@/components/gastos/tipos";

type DatosCompartidos = { gastos: GastoPendiente[]; proveedores: string[] };

const Contexto = createContext<DatosCompartidos>({ gastos: [], proveedores: [] });

/**
 * Gastos pendientes y proveedores usados, compartidos por todas las filas de la
 * cartera (se mandan una sola vez al navegador, no una por cheque).
 */
export function DatosCheques({
  gastos,
  proveedores,
  children,
}: DatosCompartidos & { children: React.ReactNode }) {
  const valor = useMemo(() => ({ gastos, proveedores }), [gastos, proveedores]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDatosCheques(): DatosCompartidos {
  return useContext(Contexto);
}

import { getPerfil } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Layout pelado para documentos imprimibles (recibos, planillas, reportes). */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl bg-white px-6 py-8 text-foreground print:max-w-none print:p-0">
      {children}
    </div>
  );
}

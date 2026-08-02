import { redirect } from "next/navigation";
import { getPerfil, rutaInicio } from "@/lib/auth";

export default async function Home() {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  redirect(rutaInicio(perfil.rol));
}

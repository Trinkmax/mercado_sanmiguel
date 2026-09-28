import { redirect } from "next/navigation";
import { LOGIN_SIN_ACCESO, getPerfil, rutaInicio, sesionSinAcceso } from "@/lib/auth";

export default async function Home() {
  const perfil = await getPerfil();
  if (!perfil) redirect((await sesionSinAcceso()) ? LOGIN_SIN_ACCESO : "/login");
  redirect(rutaInicio(perfil.rol));
}

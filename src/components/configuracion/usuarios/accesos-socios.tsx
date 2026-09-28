"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound, Loader2, Search, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { crearAccesoSocio } from "@/lib/actions/usuarios";
import type { Rol } from "@/lib/auth";
import { puedeGestionarRol } from "@/lib/roles";
import { esDniValido, formatDni, normalizarDni } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shared/empty-state";
import { CampoContrasena, CampoDni, CampoEmailOpcional } from "./campos";
import { Credencial } from "./credencial";
import { FilaUsuario } from "./fila-usuario";
import { dniDesdeCuit, generarContrasena } from "./contrasena";
import type { ClienteAcceso } from "./tipos";

function plano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Vista = "sin" | "con";

/**
 * Acceso de los socios al portal (F2): la lista de clientes partida en "Sin acceso"
 * y "Con acceso", con buscador por carpeta, nombre, apodo o puesto. "Dar acceso" se
 * abre en la misma fila con el DNI sacado del CUIT y una contraseña lista.
 */
export function AccesosSocios({
  clientes,
  miUserId,
  miRol,
  nombresPorId,
  hayClaveAdmin,
}: {
  clientes: ClienteAcceso[];
  miUserId: string;
  miRol: Rol;
  nombresPorId: Record<string, string>;
  hayClaveAdmin: boolean;
}) {
  const sinAcceso = clientes.filter((c) => !c.acceso);
  const conAcceso = clientes.filter((c) => c.acceso);
  const [vista, setVista] = useState<Vista>(sinAcceso.length > 0 ? "sin" : "con");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  // La credencial vive acá: al dar acceso el cliente pasa a "Con acceso" y su fila se mueve.
  const [credencial, setCredencial] = useState<{ nombre: string; dni: string; password: string } | null>(null);

  const lista = vista === "sin" ? sinAcceso : conAcceso;
  const visibles = useMemo(() => {
    const q = plano(busqueda.trim());
    if (!q) return lista;
    const numero = busqueda.trim().replace(/^n[°º.]?\s*/i, "");
    return lista.filter(
      (c) =>
        String(c.codigo) === numero ||
        plano(`${c.nombre} ${c.apodo ?? ""} ${c.lugares ?? ""}`).includes(q) ||
        (normalizarDni(busqueda).length >= 4 && (c.acceso?.dni ?? "").includes(normalizarDni(busqueda)))
    );
  }, [lista, busqueda]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Socios en el portal</h2>
        <p className="text-sm text-muted-foreground">
          Desde el portal el socio ve su cuenta, descarga sus recibos y recibe las comunicaciones.
          Entra con su DNI.
        </p>
      </div>

      {credencial ? (
        <Credencial
          titulo="Acceso al portal creado"
          nombre={credencial.nombre}
          dni={credencial.dni}
          password={credencial.password}
          onListo={() => setCredencial(null)}
        />
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <ToggleGroup
          type="single"
          variant="outline"
          value={vista}
          onValueChange={(v) => {
            if (v) {
              setVista(v as Vista);
              setAbierto(null);
            }
          }}
          className="w-full md:w-auto"
          aria-label="Ver clientes"
        >
          <ToggleGroupItem value="sin" className="h-12 flex-1 px-5 text-base md:flex-none">
            Sin acceso <span className="tabular opacity-80">{sinAcceso.length}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="con" className="h-12 flex-1 px-5 text-base md:flex-none">
            Con acceso <span className="tabular opacity-80">{conAcceso.length}</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="relative md:ml-auto md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Carpeta, nombre, apodo o puesto"
            aria-label="Buscar cliente"
            className="h-12 bg-card pl-10 text-base md:text-base"
          />
        </div>
      </div>

      {clientes.length === 0 ? (
        <EmptyState
          icono={Store}
          titulo="Todavía no hay clientes"
          descripcion="Cuando se carguen clientes van a aparecer acá para darles acceso al portal."
        />
      ) : visibles.length === 0 ? (
        <EmptyState
          icono={Search}
          titulo={busqueda ? "No encontramos a nadie con eso" : vista === "sin" ? "Todos tienen acceso" : "Nadie tiene acceso todavía"}
          descripcion={
            busqueda
              ? "Probá con el número de carpeta, otra parte del nombre o el número de puesto."
              : vista === "sin"
                ? "Todos los clientes ya pueden entrar al portal."
                : "Pasá a \"Sin acceso\" y tocá \"Dar acceso\" en el cliente."
          }
        />
      ) : vista === "sin" ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visibles.map((c) => (
            <FilaSinAcceso
              key={c.id}
              cliente={c}
              abierto={abierto === c.id}
              onAbrir={() => setAbierto(abierto === c.id ? null : c.id)}
              onCreado={(datos) => {
                setAbierto(null);
                setCredencial(datos);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              hayClaveAdmin={hayClaveAdmin}
            />
          ))}
        </ul>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visibles.map((c) =>
            c.acceso ? (
              <FilaUsuario
                key={c.id}
                usuario={c.acceso}
                soyYo={c.acceso.user_id === miUserId}
                puedeGestionar={puedeGestionarRol(miRol, "socio")}
                nombresPorId={nombresPorId}
                mostrarRol={false}
                detalle={<Referencia cliente={c} />}
              />
            ) : null
          )}
        </ul>
      )}
    </div>
  );
}

function Referencia({ cliente }: { cliente: ClienteAcceso }) {
  return (
    <span>
      <span className="font-medium text-foreground tabular">N° {cliente.codigo}</span> · {cliente.nombre}
      {cliente.apodo ? ` (${cliente.apodo})` : ""}
      {cliente.lugares ? ` · ${cliente.lugares}` : ""}
    </span>
  );
}

function FilaSinAcceso({
  cliente,
  abierto,
  onAbrir,
  onCreado,
  hayClaveAdmin,
}: {
  cliente: ClienteAcceso;
  abierto: boolean;
  onAbrir: () => void;
  onCreado: (datos: { nombre: string; dni: string; password: string }) => void;
  hayClaveAdmin: boolean;
}) {
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">
            <span className="tabular text-muted-foreground">N° {cliente.codigo}</span> · {cliente.nombre}
            {cliente.apodo ? <span className="font-normal text-muted-foreground"> ({cliente.apodo})</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">{cliente.lugares ?? "Sin lugar en el plano"}</p>
        </div>
        <Button
          variant={abierto ? "secondary" : "default"}
          className="min-h-11 px-4 text-sm font-semibold"
          onClick={onAbrir}
          aria-expanded={abierto}
          disabled={!hayClaveAdmin}
        >
          <KeyRound className="size-4" strokeWidth={2} />
          {abierto ? "Cerrar" : "Dar acceso"}
        </Button>
      </div>

      {/* El formulario se monta al abrir: la contraseña se genera en ese momento. */}
      {abierto ? <FormDarAcceso cliente={cliente} onCreado={onCreado} /> : null}
    </li>
  );
}

function FormDarAcceso({
  cliente,
  onCreado,
}: {
  cliente: ClienteAcceso;
  onCreado: (datos: { nombre: string; dni: string; password: string }) => void;
}) {
  const dniCuit = cliente.tipoPersona === "fisica" ? dniDesdeCuit(cliente.cuit) : null;
  const [dni, setDni] = useState(dniCuit ?? "");
  const [nombre, setNombre] = useState(cliente.tipoPersona === "fisica" ? cliente.nombre : "");
  const [password, setPassword] = useState(() => generarContrasena());
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function dar() {
    if (!esDniValido(dni)) {
      setError("El DNI tiene 7 u 8 números.");
      return;
    }
    if (nombre.trim().length < 3) {
      setError("Poné el nombre y apellido de quien va a entrar.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 letras o números.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await crearAccesoSocio({
        cliente_id: cliente.id,
        nombre: nombre.trim(),
        dni,
        password,
        email: email || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Listo. ${res.data.nombre} ya puede entrar al portal con su DNI ${formatDni(res.data.dni)}.`);
      onCreado({ nombre: res.data.nombre, dni: res.data.dni, password });
    });
  }

  return (
    <div className="mt-4 space-y-5 rounded-lg border bg-card p-4">
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoDni
          id={`socio-dni-${cliente.id}`}
          valor={dni}
          onCambiar={setDni}
          ayuda={
            dniCuit && dni === dniCuit
              ? "Lo sacamos del CUIT: revisalo con el documento."
              : "Con este DNI va a entrar al portal."
          }
        />
        <div className="space-y-2">
          <Label htmlFor={`socio-nombre-${cliente.id}`} className="text-base font-semibold">
            ¿Quién va a entrar?
          </Label>
          <Input
            id={`socio-nombre-${cliente.id}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="off"
            placeholder="Nombre y apellido"
            className="h-14 bg-card text-lg md:text-lg"
          />
          <p className="text-sm text-muted-foreground">
            {cliente.tipoPersona === "juridica"
              ? "Es una empresa: poné la persona que va a usar el portal."
              : "El titular de la carpeta, o quien la maneje."}
          </p>
        </div>
      </div>
      <CampoContrasena id={`socio-pass-${cliente.id}`} valor={password} onCambiar={setPassword} />
      <CampoEmailOpcional id={`socio-email-${cliente.id}`} valor={email} onCambiar={setEmail} />
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
        onClick={dar}
        disabled={pendiente}
      >
        {pendiente ? <Loader2 className="size-5 animate-spin" /> : <UserPlus className="size-5" strokeWidth={2} />}
        {pendiente ? "Dando acceso…" : `Dar acceso a ${cliente.nombre}`}
      </Button>
    </div>
  );
}

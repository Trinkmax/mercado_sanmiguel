/** Mientras carga: el título ya está y los renglones ocupan su lugar. */
export default function LoadingMensajes() {
  return (
    <>
      <div className="portal-espacio-chico">
        <h1 className="portal-titulo">Mensajes</h1>
      </div>
      <div className="portal-suelo !pt-1" aria-hidden>
        <div className="hoja hoja-filas">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-[4.6rem] items-center gap-3 px-4 py-3">
              <div className="esqueleto size-11 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="esqueleto h-4 w-44 max-w-full" />
                <div className="esqueleto h-3.5 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

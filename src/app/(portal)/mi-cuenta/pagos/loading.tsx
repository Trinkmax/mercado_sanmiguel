/** Mientras carga: el título ya está y los talones ocupan su lugar. */
export default function LoadingPagos() {
  return (
    <>
      <div className="portal-espacio-chico">
        <h1 className="portal-titulo">Mis pagos</h1>
      </div>
      <div className="portal-suelo !pt-1" aria-hidden>
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="talon">
              <div className="talon-fecha">
                <div className="esqueleto h-7 w-8" />
              </div>
              <div className="flex-1 space-y-2 py-3 pr-3 pl-4">
                <div className="esqueleto h-5 w-28" />
                <div className="esqueleto h-3.5 w-40 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

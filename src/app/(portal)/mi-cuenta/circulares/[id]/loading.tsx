/** Mientras carga: la forma de la conversación. */
export default function LoadingConversacion() {
  return (
    <>
      <div className="portal-espacio-chico" aria-hidden>
        <div className="h-7 w-28 rounded-lg bg-white/25" />
        <div className="mt-3 h-8 w-64 max-w-full rounded-lg bg-white/25" />
      </div>
      <div className="chat-fondo" aria-hidden>
        <div className="flex flex-col gap-3 p-3">
          <div className="hoja space-y-2 p-4">
            <div className="esqueleto h-6 w-28" />
            <div className="esqueleto h-4 w-56 max-w-full" />
          </div>
          <div className="esqueleto ml-auto h-20 w-2/3 rounded-2xl" />
          <div className="esqueleto h-16 w-3/5 rounded-2xl" />
        </div>
      </div>
    </>
  );
}

export function ListaMotivos({ motivos }: { motivos: { nome: string; quantidade: number; percentual: number }[] }) {
  if (motivos.length === 0) return <p className="text-sm text-slate-500">Nenhuma perda no período.</p>
  return (
    <ul className="space-y-3">
      {motivos.map((m) => (
        <li key={m.nome}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
            <span className="font-medium text-slate-700">{m.nome}</span>
            <span className="text-slate-600">
              <strong className="text-marinho">{m.quantidade}</strong> · {String(m.percentual).replace('.', ',')}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-laranja" style={{ width: `${m.percentual}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

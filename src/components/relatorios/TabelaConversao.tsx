import { taxa, type ContagemConversao } from '@/lib/dominio/relatorios'

export function TabelaConversao({
  grupos,
  rotuloGrupo,
}: {
  grupos: { nome: string; contagem: ContagemConversao }[]
  rotuloGrupo: string
}) {
  if (grupos.length === 0) return <p className="text-sm text-slate-500">Sem dados no período.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="py-2 pr-3 font-medium">{rotuloGrupo}</th>
            <th className="px-2 py-2 text-right font-medium">MVPs</th>
            <th className="px-2 py-2 text-right font-medium">Respostas</th>
            <th className="px-2 py-2 text-right font-medium">Propostas</th>
            <th className="px-2 py-2 text-right font-medium">Fechamentos</th>
            <th className="py-2 pl-2 text-right font-medium">Taxa de fechamento</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ nome, contagem: c }) => {
            const t = taxa(c.fechamento, c.mvp)
            return (
              <tr key={nome} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-medium text-slate-700">{nome}</td>
                <td className="px-2 py-2 text-right">{c.mvp}</td>
                <td className="px-2 py-2 text-right">{c.resposta}</td>
                <td className="px-2 py-2 text-right">{c.proposta}</td>
                <td className="px-2 py-2 text-right">{c.fechamento}</td>
                <td className="py-2 pl-2 text-right">{t === null ? '—' : `${String(t).replace('.', ',')}%`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { hojeEmPalmas } from '@/lib/dominio/datas'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes } from '@/lib/servicos/config'
import { listarLeads } from '@/lib/servicos/leads'
import { valoresAbertosPorLead } from '@/lib/servicos/propostas'
import { QuadroFunil } from '@/components/funil/QuadroFunil'

export const dynamic = 'force-dynamic'

export default async function FunilPage() {
  const db = await criarClienteServidor()
  const [leads, motivos, valores] = await Promise.all([
    listarLeads(db, {}),
    listarOpcoes(db, 'motivo_perda'),
    valoresAbertosPorLead(db),
  ])
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-marinho">Funil</h1>
      <QuadroFunil
        leads={leads}
        valores={valores}
        hoje={hojeEmPalmas()} 
        motivos={motivos.map((m) => ({ id: m.id, nome: m.nome }))}
      />
    </div>
  )
}

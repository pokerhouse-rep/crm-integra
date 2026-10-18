import { notFound } from 'next/navigation'
import { formatarTelefone } from '@/lib/dominio/telefone'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes } from '@/lib/servicos/config'
import { obterLead } from '@/lib/servicos/leads'
import { ErroNegocio } from '@/lib/servicos/tipos'
import { FormLead } from '@/components/leads/FormLead'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditarLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const db = await criarClienteServidor()
  const detalhe = await obterLead(db, id).catch((e) => {
    if (e instanceof ErroNegocio) return null
    throw e
  })
  if (!detalhe) notFound()
  const l = detalhe.lead
  const [nichos, origens] = await Promise.all([
    listarOpcoes(db, 'nicho', [l.nicho_id]),
    listarOpcoes(db, 'origem', [l.origem_id]),
  ])
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-marinho">Editar lead</h1>
      <FormLead
        leadId={l.id}
        valoresIniciais={{
          nomeContato: l.nome_contato,
          whatsapp: formatarTelefone(l.whatsapp),
          empresa: l.empresa ?? '',
          email: l.email ?? '',
          cidade: l.cidade ?? '',
          nichoId: l.nicho_id ?? '',
          origemId: l.origem_id ?? '',
          linkMvp: l.link_mvp ?? '',
          observacoes: l.observacoes ?? '',
        }}
        nichos={nichos.map((n) => ({ id: n.id, nome: n.nome }))}
        origens={origens.map((o) => ({ id: o.id, nome: o.nome }))}
      />
    </div>
  )
}

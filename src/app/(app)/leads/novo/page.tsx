import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes } from '@/lib/servicos/config'
import { FormLead } from '@/components/leads/FormLead'

export const dynamic = 'force-dynamic'

export default async function NovoLeadPage() {
  const db = await criarClienteServidor()
  const [nichos, origens] = await Promise.all([listarOpcoes(db, 'nicho'), listarOpcoes(db, 'origem')])
  const padrao = origens.find((o) => o.nome === 'Prospecção ativa')
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-marinho">Novo lead</h1>
      <FormLead
        valoresIniciais={{
          nomeContato: '',
          whatsapp: '',
          empresa: '',
          email: '',
          cidade: '',
          nichoId: '',
          origemId: padrao?.id ?? '',
          linkMvp: '',
          observacoes: '',
        }}
        nichos={nichos.map((n) => ({ id: n.id, nome: n.nome }))}
        origens={origens.map((o) => ({ id: o.id, nome: o.nome }))}
      />
    </div>
  )
}

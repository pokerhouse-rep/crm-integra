import Link from 'next/link'
import { notFound } from 'next/navigation'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarServicos } from '@/lib/servicos/catalogo'
import { listarContratos } from '@/lib/servicos/contratos'
import { obterProposta } from '@/lib/servicos/propostas'
import { ErroNegocio } from '@/lib/servicos/tipos'
import { uuidValido } from '@/lib/validacao'
import { EditorItens } from '@/components/propostas/EditorItens'
import { HistoricoVersoes } from '@/components/propostas/HistoricoVersoes'
import { COR_STATUS_PROPOSTA, ROTULO_STATUS_PROPOSTA } from '@/components/propostas/rotulos'

export const dynamic = 'force-dynamic'

export default async function PropostaPage({ params }: { params: Promise<{ id: string; propostaId: string }> }) {
  const { id, propostaId } = await params
  if (!uuidValido(id) || !uuidValido(propostaId)) notFound()
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  const detalhe = await obterProposta(db, propostaId).catch((e) => {
    if (e instanceof ErroNegocio) return null
    throw e
  })
  if (!detalhe || detalhe.proposta.lead_id !== id) notFound()
  const { proposta, lead, versoes } = detalhe
  const atual = versoes[0]
  if (!atual) notFound()

  const [servicos, contratos] = await Promise.all([
    listarServicos(db),
    proposta.status === 'aceita' ? listarContratos(db, hoje, { leadId: id }) : Promise.resolve([]),
  ])
  const contrato = contratos.find((c) => c.proposta_id === proposta.id)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold break-words text-marinho">{proposta.titulo}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lead:{' '}
          <Link href={`/leads/${lead.id}`} className="font-medium text-azul underline focus-visible:outline-2 focus-visible:outline-azul">
            {lead.nome_contato}
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${COR_STATUS_PROPOSTA[proposta.status]}`}>
            {ROTULO_STATUS_PROPOSTA[proposta.status]}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Versão {atual.numero}</span>
        </div>
      </header>

      <EditorItens
        key={`${atual.id}-${proposta.status}`}
        propostaId={proposta.id}
        status={proposta.status}
        tituloProposta={proposta.titulo}
        hoje={hoje}
        servicos={servicos.map((s) => ({
          id: s.id,
          nome: s.nome,
          tipo: s.tipo,
          precoCentavos: Number(s.preco_centavos),
        }))}
        itensIniciais={atual.itens}
        contratoId={contrato?.id ?? null}
      />

      <HistoricoVersoes
        versoes={versoes.slice(1).map((v) => ({
          numero: v.numero,
          enviadaEm: v.enviada_em,
          unicoCentavos: v.total_unico_centavos,
          recorrenteCentavos: v.total_recorrente_centavos,
          itens: v.itens,
        }))}
      />
    </div>
  )
}

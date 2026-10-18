import Link from 'next/link'
import { formatarDataBR, hojeEmPalmas } from '@/lib/dominio/datas'
import { linkWhatsApp, preencherModelo } from '@/lib/dominio/mensagens'
import { criarClienteServidor } from '@/lib/supabase/server'
import { agendaDoDia, type ItemAgenda } from '@/lib/servicos/agenda'
import { listarOpcoes } from '@/lib/servicos/config'
import { CartaoRetorno } from '@/components/hoje/CartaoRetorno'
import { CartaoTarefa } from '@/components/hoje/CartaoTarefa'

export const dynamic = 'force-dynamic'

export default async function HojePage() {
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  const [agenda, nichos, motivos] = await Promise.all([
    agendaDoDia(db, hoje),
    listarOpcoes(db, 'nicho'),
    listarOpcoes(db, 'motivo_perda'),
  ])
  const nomeNicho = new Map(nichos.map((n) => [n.id, n.nome]))
  const motivosSimples = motivos.map((m) => ({ id: m.id, nome: m.nome }))

  const todos = [...agenda.atrasados, ...agenda.hoje]
  const qtdRetornos = todos.filter((i) => i.tipo === 'retorno').length
  const qtdTarefas = todos.length - qtdRetornos

  function renderizar(item: ItemAgenda, atrasado: boolean) {
    if (item.tipo === 'tarefa') {
      const t = item.tarefa
      return (
        <CartaoTarefa
          key={`t-${t.id}`}
          hoje={hoje}
          dados={{
            id: t.id,
            titulo: t.titulo,
            data: t.data,
            hora: t.hora,
            atrasado,
            lead: item.lead ? { id: item.lead.id, nome: item.lead.nome_contato } : null,
          }}
        />
      )
    }
    const { lead, retorno } = item
    const mensagem = preencherModelo(item.modelo?.texto ?? '', {
      nome: lead.nome_contato,
      empresa: lead.empresa,
      link_mvp: lead.link_mvp,
      cidade: lead.cidade,
    })
    return (
      <CartaoRetorno
        key={`r-${retorno.id}`}
        hoje={hoje}
        motivos={motivosSimples}
        dados={{
          retornoId: retorno.id,
          leadId: lead.id,
          nome: lead.nome_contato,
          empresa: lead.empresa,
          nicho: lead.nicho_id ? (nomeNicho.get(lead.nicho_id) ?? null) : null,
          linkMvp: lead.link_mvp,
          dataPrevista: retorno.data_prevista,
          atrasado,
          rotuloPasso: item.passo === 0 ? 'Retorno avulso' : `Retorno ${item.passo} de ${item.totalPassos}`,
          frio: lead.frio === true || retorno.origem === 'reativacao',
          mensagem,
          linkWhatsApp: linkWhatsApp(lead.whatsapp, mensagem),
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-marinho">Hoje, {formatarDataBR(hoje).slice(0, 5)}</h1>
        <p className="text-sm text-slate-600">
          {qtdRetornos} {qtdRetornos === 1 ? 'retorno' : 'retornos'} · {qtdTarefas}{' '}
          {qtdTarefas === 1 ? 'tarefa' : 'tarefas'}
        </p>
      </header>

      {todos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-slate-700">Nada para hoje. 🎯</p>
          <Link
            href="/leads/novo"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-laranja px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            Cadastrar lead
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {agenda.atrasados.length > 0 && (
            <section aria-labelledby="sec-atrasados">
              <h2 id="sec-atrasados" className="mb-2 text-sm font-semibold uppercase tracking-wide text-laranja">
                Atrasados ({agenda.atrasados.length})
              </h2>
              <div className="space-y-3">{agenda.atrasados.map((i) => renderizar(i, true))}</div>
            </section>
          )}
          {agenda.hoje.length > 0 && (
            <section aria-labelledby="sec-hoje">
              <h2 id="sec-hoje" className="mb-2 text-sm font-semibold uppercase tracking-wide text-marinho">
                Hoje ({agenda.hoje.length})
              </h2>
              <div className="space-y-3">{agenda.hoje.map((i) => renderizar(i, false))}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

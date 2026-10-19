import { centavosParaCsv, type Celula } from '@/lib/dominio/csv'
import { rotuloCobranca } from '@/lib/dominio/cobrancas'
import { formatarDataBR } from '@/lib/dominio/datas'
import { formatarPercentual } from '@/lib/dominio/dinheiro'
import { descreverEvento } from '@/lib/dominio/eventos'
import { dataEmPalmas } from '@/lib/dominio/periodo'
import { formatarTelefone } from '@/lib/dominio/telefone'
import { ETAPAS } from '@/lib/dominio/tipos'
import { lerTodas } from './paginacao'
import type { SupabaseClient } from './tipos'

export const TABELAS_EXPORTACAO = ['leads', 'retornos', 'tarefas', 'propostas', 'contratos', 'cobrancas', 'historico'] as const
export type TabelaExportacao = (typeof TABELAS_EXPORTACAO)[number]

const sn = (b: boolean | null | undefined): string => (b ? 'Sim' : 'Não')
const data = (d: string | null | undefined): string => (d ? formatarDataBR(d) : '')
const mesAno = (d: string | null | undefined): string => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const tipoValor = (t: string): string => (t === 'unico' ? 'Único' : 'Mensal')
const dinheiro = (c: number | string | null | undefined): string => (c === null || c === undefined ? '' : centavosParaCsv(Number(c)))

/** '2026-10-19T15:30:00Z' → '19/10/2026 12:30' (Palmas, UTC−3). */
export function dataHoraPalmas(ts: string): string {
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Araguaina',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ts))
  return `${formatarDataBR(dataEmPalmas(ts))} ${hora}`
}
const dataHora = (ts: string | null | undefined): string => (ts ? dataHoraPalmas(ts) : '')

const SITUACAO_RETORNO: Record<string, string> = { pendente: 'Pendente', feito: 'Feito', cancelado: 'Cancelado' }
const ORIGEM_RETORNO: Record<string, string> = {
  sequencia: 'Sequência', reativacao: 'Reativação', adiado: 'Adiado', manual: 'Manual', proposta: 'Proposta',
}
const RESULTADO_RETORNO: Record<string, string> = {
  respondeu: 'Respondeu', pediu_tempo: 'Pediu tempo', sem_interesse: 'Sem interesse', sem_resposta: 'Sem resposta',
}
const STATUS_PROPOSTA: Record<string, string> = { rascunho: 'Rascunho', enviada: 'Enviada', aceita: 'Aceita', recusada: 'Recusada' }
const STATUS_CONTRATO: Record<string, string> = { ativo: 'Ativo', pausado: 'Pausado', cancelado: 'Cancelado' }
const STATUS_COBRANCA: Record<string, string> = { aberta: 'Aberta', paga: 'Paga', suspensa: 'Suspensa' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Lin = Record<string, any>
const nomeLead = (l: Lin | null | undefined): string => l?.nome_contato ?? ''
const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0)

function ler(db: SupabaseClient, tabela: string, colunas: string, ordem: string[]): Promise<Lin[]> {
  return lerTodas<Lin>((de, ate) => {
    let q = db.from(tabela).select(colunas)
    for (const o of ordem) q = q.order(o, { ascending: true })
    return q.order('id', { ascending: true }).range(de, ate)
  }, `Falha ao exportar ${tabela}`)
}

export async function linhasExportacao(db: SupabaseClient, tabela: TabelaExportacao): Promise<Celula[][]> {
  switch (tabela) {
    case 'leads': {
      const rs = await ler(
        db, 'leads',
        '*, nicho:opcoes!leads_nicho_id_fkey(nome), origem:opcoes!leads_origem_id_fkey(nome), motivo:opcoes!leads_motivo_perda_id_fkey(nome)',
        ['created_at'],
      )
      return [
        ['Nome', 'Empresa', 'WhatsApp', 'E-mail', 'Cidade', 'Nicho', 'Origem', 'Etapa', 'Frio', 'Cliente', 'Motivo da perda', 'Link do MVP', 'MVP enviado em', 'Observações', 'Cadastrado em'],
        ...rs.map((l): Celula[] => [
          l.nome_contato, l.empresa, formatarTelefone(l.whatsapp), l.email, l.cidade,
          l.nicho?.nome ?? null, l.origem?.nome ?? null,
          ETAPAS.find((e) => e.valor === l.etapa)?.rotulo ?? l.etapa,
          sn(l.frio), sn(l.cliente), l.motivo?.nome ?? null, l.link_mvp, data(l.mvp_enviado_em), l.observacoes,
          dataHora(l.created_at),
        ]),
      ]
    }
    case 'retornos': {
      const rs = await ler(db, 'retornos', '*, leads(nome_contato, whatsapp)', ['created_at'])
      return [
        ['Lead', 'WhatsApp', 'Data prevista', 'Ciclo', 'Origem', 'Situação', 'Resultado', 'Feito em'],
        ...rs.map((r): Celula[] => [
          nomeLead(r.leads), r.leads ? formatarTelefone(r.leads.whatsapp) : '', data(r.data_prevista), r.ciclo,
          ORIGEM_RETORNO[r.origem] ?? r.origem, SITUACAO_RETORNO[r.status] ?? r.status,
          r.resultado ? (RESULTADO_RETORNO[r.resultado] ?? r.resultado) : null, dataHora(r.feito_em),
        ]),
      ]
    }
    case 'tarefas': {
      const rs = await ler(db, 'tarefas', '*, leads(nome_contato)', ['created_at'])
      return [
        ['Título', 'Lead', 'Data', 'Hora', 'Feita', 'Feita em'],
        ...rs.map((t): Celula[] => [
          t.titulo, nomeLead(t.leads), data(t.data), t.hora ? String(t.hora).slice(0, 5) : null, sn(t.feita), dataHora(t.feita_em),
        ]),
      ]
    }
    case 'propostas': {
      const rs = await ler(
        db, 'itens_proposta',
        '*, versoes_proposta(numero, enviada_em, propostas(id, titulo, status, created_at, leads(nome_contato)))',
        [],
      )
      rs.sort((a, b) => {
        const pa = a.versoes_proposta?.propostas
        const pb = b.versoes_proposta?.propostas
        return (
          cmp(pa?.created_at ?? '', pb?.created_at ?? '') ||
          cmp(pa?.id ?? '', pb?.id ?? '') ||
          cmp(a.versoes_proposta?.numero ?? 0, b.versoes_proposta?.numero ?? 0) ||
          cmp(a.ordem ?? 0, b.ordem ?? 0)
        )
      })
      return [
        ['Lead', 'Proposta', 'Status', 'Versão', 'Enviada em', 'Item', 'Tipo', 'Valor', 'Parcelas', 'Mês de início', 'Desconto'],
        ...rs.map((i): Celula[] => {
          const v = i.versoes_proposta
          const p = v?.propostas
          const desconto =
            i.desconto_tipo === 'percentual' ? formatarPercentual(Number(i.desconto_valor))
              : i.desconto_tipo === 'valor' ? dinheiro(i.desconto_valor) : null
          return [
            nomeLead(p?.leads), p?.titulo ?? '', STATUS_PROPOSTA[p?.status] ?? p?.status ?? '', v?.numero ?? null,
            dataHora(v?.enviada_em), i.descricao, tipoValor(i.tipo), dinheiro(i.valor_centavos), i.parcelas,
            mesAno(i.mes_inicio), desconto,
          ]
        }),
      ]
    }
    case 'contratos': {
      const rs = await ler(
        db, 'contrato_itens',
        '*, contratos(id, descricao, status, data_inicio, dia_vencimento, pausado_em, cancelado_em, created_at, leads(nome_contato))',
        [],
      )
      rs.sort((a, b) =>
        cmp(a.contratos?.created_at ?? '', b.contratos?.created_at ?? '') ||
        cmp(a.contratos?.id ?? '', b.contratos?.id ?? '') ||
        cmp(a.ordem ?? 0, b.ordem ?? 0),
      )
      return [
        ['Cliente', 'Contrato', 'Situação', 'Início', 'Dia de vencimento', 'Pausado em', 'Cancelado em', 'Item', 'Tipo', 'Valor', 'Parcelas', 'Mês de início'],
        ...rs.map((i): Celula[] => {
          const c = i.contratos
          return [
            nomeLead(c?.leads), c?.descricao ?? '', STATUS_CONTRATO[c?.status] ?? c?.status ?? '', data(c?.data_inicio),
            c?.dia_vencimento ?? null, data(c?.pausado_em), data(c?.cancelado_em), i.descricao, tipoValor(i.tipo),
            dinheiro(i.valor_centavos), i.parcelas, mesAno(i.mes_inicio),
          ]
        }),
      ]
    }
    case 'cobrancas': {
      const rs = await ler(db, 'cobrancas', '*, contratos(descricao), contrato_itens(descricao), leads(nome_contato)', ['vencimento'])
      return [
        ['Cliente', 'Contrato', 'Cobrança', 'Vencimento', 'Valor', 'Situação', 'Pago em', 'Valor pago'],
        ...rs.map((c): Celula[] => [
          nomeLead(c.leads), c.contratos?.descricao ?? '',
          rotuloCobranca({
            descricaoItem: c.contrato_itens?.descricao ?? '', tipo: c.tipo, numero: c.numero,
            totalParcelas: c.total_parcelas, competencia: c.competencia,
          }),
          data(c.vencimento), dinheiro(c.valor_centavos), STATUS_COBRANCA[c.status] ?? c.status, data(c.pago_em),
          dinheiro(c.valor_pago_centavos),
        ]),
      ]
    }
    case 'historico': {
      const rs = await ler(db, 'eventos', '*, leads(nome_contato)', ['ocorrido_em'])
      return [
        ['Data e hora', 'Lead', 'Evento', 'Detalhes'],
        ...rs.map((e): Celula[] => [dataHora(e.ocorrido_em), nomeLead(e.leads), descreverEvento(e.tipo, e.dados).texto, JSON.stringify(e.dados ?? {})]),
      ]
    }
  }
}

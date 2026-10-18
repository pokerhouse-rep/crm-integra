import { somarDias, type DataISO } from '@/lib/dominio/datas'
import {
  lancarSeErro,
  type LeadResumo,
  type ModeloMensagem,
  type Retorno,
  type SupabaseClient,
  type Tarefa,
} from './tipos'

export type ItemAgenda =
  | {
      tipo: 'retorno'
      retorno: Retorno
      lead: LeadResumo
      passo: number
      totalPassos: number
      modelo: ModeloMensagem | null
    }
  | { tipo: 'tarefa'; tarefa: Tarefa; lead: LeadResumo | null }

export interface AgendaDia {
  atrasados: ItemAgenda[]
  hoje: ItemAgenda[]
}

type RetornoComLead = Retorno & { leads: LeadResumo }
type TarefaComLead = Tarefa & { leads: LeadResumo | null }

const dataDoItem = (i: ItemAgenda): DataISO => (i.tipo === 'retorno' ? i.retorno.data_prevista : i.tarefa.data)
const chaveOrdem = (i: ItemAgenda): string =>
  `${dataDoItem(i)}|${i.tipo === 'retorno' ? '0' : '1'}|${i.tipo === 'tarefa' ? (i.tarefa.hora ?? '') : ''}`
const porData = (a: ItemAgenda, b: ItemAgenda) => chaveOrdem(a).localeCompare(chaveOrdem(b))

const emSequencia = (r: Pick<Retorno, 'origem'>) => r.origem === 'sequencia' || r.origem === 'reativacao'

/** Itens pendentes até `ate` (inclusive); com `de`, a partir dele. */
async function carregarItens(db: SupabaseClient, de: DataISO | null, ate: DataISO): Promise<ItemAgenda[]> {
  let qr = db
    .from('retornos')
    .select('*, leads(*)')
    .eq('status', 'pendente')
    .lte('data_prevista', ate)
    .order('data_prevista')
  let qt = db.from('tarefas').select('*, leads(*)').eq('feita', false).lte('data', ate).order('data')
  if (de) {
    qr = qr.gte('data_prevista', de)
    qt = qt.gte('data', de)
  }
  const [rr, rt, rm] = await Promise.all([qr, qt, db.from('modelos_mensagem').select('*')])
  lancarSeErro(rr.error, 'Falha ao carregar retornos da agenda')
  lancarSeErro(rt.error, 'Falha ao carregar tarefas da agenda')
  lancarSeErro(rm.error, 'Falha ao carregar modelos de mensagem')
  const retornos = (rr.data ?? []) as RetornoComLead[]
  const tarefas = (rt.data ?? []) as TarefaComLead[]
  const modelos = (rm.data ?? []) as ModeloMensagem[]

  // Posição de cada retorno no ciclo: todos os retornos de sequência/reativação do lead (qualquer status).
  const leadIds = [...new Set(retornos.filter(emSequencia).map((r) => r.lead_id))]
  const ciclos = new Map<string, Retorno[]>()
  if (leadIds.length) {
    const { data, error } = await db
      .from('retornos')
      .select('*')
      .in('lead_id', leadIds)
      .in('origem', ['sequencia', 'reativacao'])
      .order('data_prevista')
      .order('created_at')
    lancarSeErro(error, 'Falha ao carregar ciclos de retornos')
    for (const r of (data ?? []) as Retorno[]) {
      const chave = `${r.lead_id}|${r.ciclo}`
      const lista = ciclos.get(chave) ?? []
      lista.push(r)
      ciclos.set(chave, lista)
    }
  }

  const porPasso = modelos.filter((m) => m.passo !== null).sort((a, b) => a.passo! - b.passo!)
  const avulso = modelos.find((m) => m.passo === null) ?? null

  const itens: ItemAgenda[] = []
  for (const r of retornos) {
    const { leads: lead, ...retorno } = r
    let passo = 0
    let totalPassos = 0
    let modelo: ModeloMensagem | null
    if (emSequencia(retorno)) {
      const lista = ciclos.get(`${retorno.lead_id}|${retorno.ciclo}`) ?? []
      totalPassos = lista.length
      passo = lista.findIndex((x) => x.id === retorno.id) + 1
      modelo = porPasso.find((m) => m.passo === passo) ?? porPasso[porPasso.length - 1] ?? null
    } else {
      modelo = avulso
    }
    itens.push({ tipo: 'retorno', retorno: retorno as Retorno, lead, passo, totalPassos, modelo })
  }
  for (const t of tarefas) {
    const { leads: lead, ...tarefa } = t
    itens.push({ tipo: 'tarefa', tarefa: tarefa as Tarefa, lead: lead ?? null })
  }
  return itens.sort(porData)
}

export async function agendaDoDia(db: SupabaseClient, hoje: DataISO): Promise<AgendaDia> {
  const itens = await carregarItens(db, null, hoje)
  return {
    atrasados: itens.filter((i) => dataDoItem(i) < hoje),
    hoje: itens.filter((i) => dataDoItem(i) === hoje),
  }
}

export async function agendaDaSemana(db: SupabaseClient, inicio: DataISO): Promise<Record<DataISO, ItemAgenda[]>> {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
  const itens = await carregarItens(db, inicio, dias[6])
  const semana: Record<DataISO, ItemAgenda[]> = Object.fromEntries(dias.map((d) => [d, [] as ItemAgenda[]]))
  for (const i of itens) semana[dataDoItem(i)].push(i)
  return semana
}

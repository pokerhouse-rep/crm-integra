import { erroSequencia } from '@/lib/validacao'
import { ErroNegocio, lancarSeErro, type Config, type ModeloMensagem, type Opcao, type SupabaseClient } from './tipos'

export async function obterConfig(db: SupabaseClient): Promise<Config> {
  const { data, error } = await db
    .from('configuracoes')
    .select('sequencia_padrao, dias_reativacao, dias_retorno_proposta, dias_lembrete_cobranca')
    .maybeSingle()
  lancarSeErro(error, 'Falha ao ler configurações')
  return {
    sequenciaPadrao: data?.sequencia_padrao ?? [2, 5, 10],
    diasReativacao: data?.dias_reativacao ?? 30,
    diasRetornoProposta: data?.dias_retorno_proposta ?? 3,
    diasLembreteCobranca: data?.dias_lembrete_cobranca ?? 3,
  }
}

/** Opções ativas do tipo pedido, ordenadas por ordem e nome. */
export async function listarOpcoes(
  db: SupabaseClient,
  tipo: 'nicho' | 'origem' | 'motivo_perda',
  /** Ids em uso que devem aparecer mesmo inativos (rotulados "(inativo)"). */
  incluirIds: (string | null)[] = [],
): Promise<Opcao[]> {
  const { data, error } = await db
    .from('opcoes')
    .select('*')
    .eq('tipo', tipo)
    .eq('ativo', true)
    .order('ordem')
    .order('nome')
  lancarSeErro(error, 'Falha ao listar opções')
  const ativas = (data ?? []) as Opcao[]
  const faltando = incluirIds.filter((id): id is string => !!id && !ativas.some((o) => o.id === id))
  if (faltando.length === 0) return ativas
  const { data: extras, error: e2 } = await db.from('opcoes').select('*').eq('tipo', tipo).in('id', faltando)
  lancarSeErro(e2, 'Falha ao listar opções')
  const inativas = ((extras ?? []) as Opcao[]).map((o) => ({ ...o, nome: `${o.nome} (inativo)` }))
  return [...ativas, ...inativas]
}

/** Modelo de mensagem avulso (sem passo), usado no botão de WhatsApp do lead. */
export async function obterModeloAvulso(db: SupabaseClient): Promise<ModeloMensagem | null> {
  const { data, error } = await db.from('modelos_mensagem').select('*').is('passo', null).order('nome').order('id').limit(1)
  lancarSeErro(error, 'Falha ao ler modelo de mensagem')
  return ((data ?? [])[0] as ModeloMensagem | undefined) ?? null
}

type TipoOpcao = Opcao['tipo']

/** Todas as opções do tipo (inclusive inativas), para a tela de configurações. */
export async function listarTodasOpcoes(db: SupabaseClient, tipo: TipoOpcao): Promise<Opcao[]> {
  const { data, error } = await db.from('opcoes').select('*').eq('tipo', tipo).order('ordem').order('nome')
  lancarSeErro(error, 'Falha ao listar opções')
  return (data ?? []) as Opcao[]
}

function inteiroEntre(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
}

export async function salvarConfig(db: SupabaseClient, parcial: Partial<Config>): Promise<void> {
  const campos: Record<string, unknown> = {}
  if (parcial.sequenciaPadrao !== undefined) {
    const seq = parcial.sequenciaPadrao
    const erro = erroSequencia(seq)
    if (erro) throw new ErroNegocio(erro)
    campos.sequencia_padrao = seq
  }
  const dias: [keyof Config, string, string][] = [
    ['diasReativacao', 'dias_reativacao', 'Os dias de reativação'],
    ['diasRetornoProposta', 'dias_retorno_proposta', 'Os dias de retorno após proposta'],
    ['diasLembreteCobranca', 'dias_lembrete_cobranca', 'Os dias de lembrete de cobrança'],
  ]
  for (const [chave, coluna, rotulo] of dias) {
    const v = parcial[chave]
    if (v === undefined) continue
    if (!inteiroEntre(v, 1, 365)) throw new ErroNegocio(`${rotulo} devem ser um número inteiro entre 1 e 365.`)
    campos[coluna] = v
  }
  if (Object.keys(campos).length === 0) return
  const { error } = await db.from('configuracoes').upsert(campos, { onConflict: 'user_id' })
  lancarSeErro(error, 'Falha ao salvar configurações')
}

export async function salvarOpcao(
  db: SupabaseClient,
  entrada: { id?: string; tipo: TipoOpcao; nome: string; ativo: boolean },
): Promise<Opcao> {
  const nome = entrada.nome.trim()
  if (!nome) throw new ErroNegocio('Informe o nome da opção.')
  const query = entrada.id
    ? db.from('opcoes').update({ nome, ativo: entrada.ativo }).eq('id', entrada.id).eq('tipo', entrada.tipo)
    : db.from('opcoes').insert({ tipo: entrada.tipo, nome, ativo: entrada.ativo })
  const { data, error } = await query.select().maybeSingle()
  if (error?.code === '23505') throw new ErroNegocio('Já existe uma opção com esse nome.')
  lancarSeErro(error, 'Falha ao salvar opção')
  if (!data) throw new ErroNegocio('Opção não encontrada.')
  return data as Opcao
}

export async function listarModelos(db: SupabaseClient): Promise<ModeloMensagem[]> {
  const { data, error } = await db
    .from('modelos_mensagem')
    .select('*')
    .order('passo', { nullsFirst: true })
    .order('nome')
  lancarSeErro(error, 'Falha ao listar modelos')
  return (data ?? []) as ModeloMensagem[]
}

export async function salvarModelo(
  db: SupabaseClient,
  entrada: { id?: string; nome: string; texto: string; passo: number | null },
): Promise<ModeloMensagem> {
  const nome = entrada.nome.trim()
  const texto = entrada.texto.trim()
  if (!nome) throw new ErroNegocio('Informe o nome do modelo.')
  if (!texto) throw new ErroNegocio('Informe o texto da mensagem.')
  const passo = entrada.passo
  if (passo !== null && !inteiroEntre(passo, 1, 365)) {
    throw new ErroNegocio('O passo deve ser um número inteiro positivo ou ficar vazio.')
  }
  let q = db.from('modelos_mensagem').select('id')
  q = passo !== null ? q.eq('passo', passo) : q.is('passo', null)
  if (entrada.id) q = q.neq('id', entrada.id)
  const { data: existentes, error: erroValidacao } = await q.limit(1)
  lancarSeErro(erroValidacao, 'Falha ao validar modelo')
  if ((existentes ?? []).length > 0) {
    throw new ErroNegocio(passo !== null ? `Já existe um modelo para o passo ${passo}.` : 'Já existe um modelo avulso.')
  }
  const query = entrada.id
    ? db.from('modelos_mensagem').update({ nome, texto, passo }).eq('id', entrada.id)
    : db.from('modelos_mensagem').insert({ nome, texto, passo })
  const { data, error } = await query.select().maybeSingle()
  lancarSeErro(error, 'Falha ao salvar modelo')
  if (!data) throw new ErroNegocio('Modelo não encontrado.')
  return data as ModeloMensagem
}

export async function excluirModelo(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('modelos_mensagem').delete().eq('id', id)
  lancarSeErro(error, 'Falha ao excluir modelo')
}

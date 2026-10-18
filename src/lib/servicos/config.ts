import { lancarSeErro, type Config, type ModeloMensagem, type Opcao, type SupabaseClient } from './tipos'

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
  const { data, error } = await db.from('modelos_mensagem').select('*').is('passo', null).limit(1)
  lancarSeErro(error, 'Falha ao ler modelo de mensagem')
  return ((data ?? [])[0] as ModeloMensagem | undefined) ?? null
}

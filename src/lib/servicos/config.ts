import { lancarSeErro, type Config, type Opcao, type SupabaseClient } from './tipos'

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
): Promise<Opcao[]> {
  const { data, error } = await db
    .from('opcoes')
    .select('*')
    .eq('tipo', tipo)
    .eq('ativo', true)
    .order('ordem')
    .order('nome')
  lancarSeErro(error, 'Falha ao listar opções')
  return (data ?? []) as Opcao[]
}

import { lancarSeErro, type Config, type SupabaseClient } from './tipos'

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

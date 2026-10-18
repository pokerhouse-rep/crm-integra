import { ErroNegocio, lancarSeErro, type SupabaseClient } from './tipos'

/** Chama uma função SQL do banco. Erros de regra (P0001) viram ErroNegocio com a mensagem em pt-BR. */
export async function chamarRpc<T = void>(
  db: SupabaseClient,
  funcao: string,
  args: Record<string, unknown>,
  contexto: string,
): Promise<T> {
  const { data, error } = await db.rpc(funcao, args)
  if (error) {
    if (error.code === 'P0001') throw new ErroNegocio(error.message)
    lancarSeErro(error, contexto)
  }
  return data as T
}

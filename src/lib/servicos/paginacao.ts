import type { PostgrestError } from '@supabase/supabase-js'
import { lancarSeErro } from './tipos'

/**
 * Lê todas as linhas de uma consulta em páginas de `tamanho` (o PostgREST limita 1000 por resposta).
 * A consulta precisa de `.order(...)` estável (inclua `id` como desempate).
 */
export async function lerTodas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  contexto: string,
  tamanho = 1000,
): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1)
    lancarSeErro(error, contexto)
    const linhas = data ?? []
    todas.push(...linhas)
    if (linhas.length < tamanho) return todas
  }
}

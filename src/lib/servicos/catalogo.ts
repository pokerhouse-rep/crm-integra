import type { TipoValor } from '@/lib/dominio/tipos'
import { ErroNegocio, lancarSeErro, type ServicoCatalogo, type SupabaseClient } from './tipos'

/** Serviços do catálogo ordenados por ordem e nome; inativos só com `incluirInativos`. */
export async function listarServicos(
  db: SupabaseClient,
  o: { incluirInativos?: boolean } = {},
): Promise<ServicoCatalogo[]> {
  let q = db.from('catalogo_servicos').select('*')
  if (!o.incluirInativos) q = q.eq('ativo', true)
  const { data, error } = await q.order('ordem').order('nome')
  lancarSeErro(error, 'Falha ao listar serviços')
  return (data ?? []) as ServicoCatalogo[]
}

export async function salvarServico(
  db: SupabaseClient,
  entrada: { id?: string; nome: string; tipo: TipoValor; precoCentavos: number; ativo: boolean },
): Promise<ServicoCatalogo> {
  const nome = entrada.nome.trim()
  if (!nome) throw new ErroNegocio('Informe o nome do serviço.')
  if (!Number.isInteger(entrada.precoCentavos) || entrada.precoCentavos < 0) {
    throw new ErroNegocio('Informe um preço válido.')
  }
  const campos = { nome, tipo: entrada.tipo, preco_centavos: entrada.precoCentavos, ativo: entrada.ativo }
  const query = entrada.id
    ? db.from('catalogo_servicos').update(campos).eq('id', entrada.id)
    : db.from('catalogo_servicos').insert(campos)
  const { data, error } = await query.select().maybeSingle()
  if (error?.code === '23505') throw new ErroNegocio('Já existe um serviço com esse nome.')
  lancarSeErro(error, 'Falha ao salvar serviço')
  if (!data) throw new ErroNegocio('Serviço não encontrado.')
  return data as ServicoCatalogo
}

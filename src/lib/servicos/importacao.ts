import { decodificarArquivo, lerCsv } from '@/lib/dominio/csv'
import {
  LIMITE_BYTES_IMPORTACAO,
  LIMITE_LINHAS_IMPORTACAO,
  mapearCabecalho,
  validarLinhas,
  type LinhaImportacao,
} from '@/lib/dominio/importacao'
import { normalizarTelefone } from '@/lib/dominio/telefone'
import { listarOpcoes } from './config'
import { lerTodas } from './paginacao'
import { chamarRpc } from './rpc'
import { ErroNegocio, type DadosLead, type SupabaseClient } from './tipos'

export async function previaImportacao(
  db: SupabaseClient,
  bytes: Uint8Array,
  padroes: { nichoId: string | null; origemId: string | null },
): Promise<{ linhas: LinhaImportacao[]; ignoradas: string[] }> {
  if (bytes.byteLength > LIMITE_BYTES_IMPORTACAO) throw new ErroNegocio('Arquivo maior que 1 MB.')
  const tabela = lerCsv(decodificarArquivo(bytes))
  if (tabela.length < 2) throw new ErroNegocio('A planilha está vazia.')
  const [cabecalho, ...dados] = tabela
  if (dados.length > LIMITE_LINHAS_IMPORTACAO) {
    throw new ErroNegocio('A planilha tem mais de 1000 linhas. Divida em arquivos menores.')
  }
  const { colunas, ignoradas, erro } = mapearCabecalho(cabecalho)
  if (erro) throw new ErroNegocio(erro)

  const [nichos, origens, existentes] = await Promise.all([
    listarOpcoes(db, 'nicho'),
    listarOpcoes(db, 'origem'),
    lerTodas<{ whatsapp: string }>(
      (de, ate) => db.from('leads').select('whatsapp').order('whatsapp').order('id').range(de, ate),
      'Falha ao ler WhatsApps existentes',
    ),
  ])
  const linhas = validarLinhas(dados, colunas, {
    nichos,
    origens,
    nichoPadraoId: padroes.nichoId,
    origemPadraoId: padroes.origemId,
    whatsappsExistentes: new Set(existentes.map((l) => l.whatsapp)),
  })
  return { linhas, ignoradas }
}

export async function importarLeads(
  db: SupabaseClient,
  leads: DadosLead[],
): Promise<{ importados: number; ignorados: number }> {
  const payload = leads.map((l) => {
    const whatsapp = normalizarTelefone(l.whatsapp)
    const nome = l.nomeContato.trim()
    if (!whatsapp || !nome) throw new ErroNegocio('Há linhas inválidas. Gere a prévia de novo.')
    return {
      nome_contato: nome,
      whatsapp,
      empresa: l.empresa ?? null,
      email: l.email ?? null,
      cidade: l.cidade ?? null,
      nicho_id: l.nichoId ?? null,
      origem_id: l.origemId ?? null,
      link_mvp: l.linkMvp ?? null,
      observacoes: l.observacoes ?? null,
    }
  })
  return chamarRpc<{ importados: number; ignorados: number }>(db, 'importar_leads', { p_leads: payload }, 'Falha ao importar leads')
}

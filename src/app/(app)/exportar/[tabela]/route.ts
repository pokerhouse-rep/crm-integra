import { gerarCsv } from '@/lib/dominio/csv'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { linhasExportacao, TABELAS_EXPORTACAO, type TabelaExportacao } from '@/lib/servicos/exportacao'
import { criarClienteServidor } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ tabela: string }> }) {
  const { tabela } = await params
  if (tabela === 'modelo') {
    const csv = gerarCsv([
      ['nome', 'whatsapp', 'empresa', 'email', 'cidade', 'nicho', 'origem', 'link do mvp', 'observacoes'],
      ['Maria Souza', '(63) 99999-0000', 'Imobiliária Exemplo', 'maria@exemplo.com', 'Palmas', 'Imobiliária', 'Prospecção ativa', 'https://exemplo.com/demo', 'Exemplo de observação'],
    ])
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="modelo-importacao.csv"',
        'Cache-Control': 'no-store',
      },
    })
  }
  if (!(TABELAS_EXPORTACAO as readonly string[]).includes(tabela)) {
    return new Response('Não encontrado', { status: 404 })
  }
  const db = await criarClienteServidor()
  const csv = gerarCsv(await linhasExportacao(db, tabela as TabelaExportacao))
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="crm-${tabela}-${hojeEmPalmas()}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

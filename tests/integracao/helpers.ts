import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { criarLead } from '@/lib/servicos/leads'
import { aceitarProposta, criarProposta, enviarProposta, salvarItens } from '@/lib/servicos/propostas'

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } }

export function clienteAdmin(): SupabaseClient {
  return createClient(url(), service(), opcoes)
}

export async function criarUsuarioTeste(): Promise<{ cliente: SupabaseClient; userId: string }> {
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const email = `teste-${sufixo}@integra.test`
  const password = `Senha-${sufixo}`

  const { data, error } = await clienteAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Falha ao criar usuário de teste: ${error?.message}`)

  const cliente = createClient(url(), anon(), opcoes)
  const login = await cliente.auth.signInWithPassword({ email, password })
  if (login.error) throw new Error(`Falha no login do usuário de teste: ${login.error.message}`)

  return { cliente, userId: data.user.id }
}

/** Lead + proposta (site 150000 em 3x, hospedagem 15000/mês desde 2026-11-01), enviada e aceita em 2026-10-19 (dia 19). */
export async function criarClienteComContrato(
  cliente: SupabaseClient,
): Promise<{ leadId: string; propostaId: string; contratoId: string }> {
  const lead = await criarLead(cliente, {
    nomeContato: 'Cliente Teste',
    whatsapp: `(63) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  })
  const propostaId = await criarProposta(cliente, lead.id)
  await salvarItens(cliente, propostaId, [
    { servicoId: null, descricao: 'Site institucional', tipo: 'unico', valorCentavos: 150000, parcelas: 3, mesInicio: null, desconto: null },
    { servicoId: null, descricao: 'Hospedagem', tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-11-01', desconto: null },
  ])
  await enviarProposta(cliente, propostaId, '2026-10-19')
  const contratoId = await aceitarProposta(cliente, propostaId, { hoje: '2026-10-19' })
  return { leadId: lead.id, propostaId, contratoId }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

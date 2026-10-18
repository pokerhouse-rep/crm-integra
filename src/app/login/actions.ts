'use server'

import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoLogin = { erro: string | null }

export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  if (!email || !senha) return { erro: 'E-mail ou senha inválidos.' }

  let status: number | undefined
  let falhou = false
  try {
    const supabase = await criarClienteServidor()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      falhou = true
      status = error.status
    }
  } catch {
    falhou = true // falha de rede/servidor fora do ar
  }
  // 400 = credencial inválida; qualquer outra falha (sem resposta, 5xx) é problema de conexão.
  if (falhou && status === 400) return { erro: 'E-mail ou senha inválidos.' }
  if (falhou) return { erro: 'Não foi possível conectar ao servidor. Verifique se o Supabase local está rodando.' }

  redirect('/hoje')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/login')
}
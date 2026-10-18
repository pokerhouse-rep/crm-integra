'use server'

import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoLogin = { erro: string | null }

export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  if (!email || !senha) return { erro: 'E-mail ou senha inválidos.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) return { erro: 'E-mail ou senha inválidos.' }

  redirect('/hoje')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/login')
}
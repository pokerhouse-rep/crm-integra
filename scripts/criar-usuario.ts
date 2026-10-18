import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

async function main() {
  const [email, senha] = process.argv.slice(2)
  if (!email || !senha) {
    console.error('Uso: npx tsx scripts/criar-usuario.ts <email> <senha>')
    process.exit(1)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }
  const admin = createClient(url, chave, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) {
    console.error(`Erro ao criar usuário: ${error.message}`)
    process.exit(1)
  }
  console.log(`Usuário criado: ${data.user.email} (${data.user.id})`)
}

main()

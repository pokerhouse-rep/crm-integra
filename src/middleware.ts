import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Renova a sessão e valida o token com o servidor de autenticação.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ehLogin = request.nextUrl.pathname === '/login'

  if (!user && !ehLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return redirecionar(url, response)
  }
  if (user && ehLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/hoje'
    url.search = ''
    return redirecionar(url, response)
  }
  return response
}

// Preserva os cookies renovados ao redirecionar.
function redirecionar(url: URL, resposta: NextResponse) {
  const redirect = NextResponse.redirect(url)
  resposta.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest|manifest\\.webmanifest|manifest\\.json|logo\\.png|icons/|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
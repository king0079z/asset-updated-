import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { type NextApiRequest, type NextApiResponse } from 'next'
import { getSupabaseEnv } from './env'

export function createClient(req: NextApiRequest, res: NextApiResponse) {
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies).map((name) => ({ name, value: req.cookies[name] || '' }))
        },
        setAll(cookiesToSet) {
          res.setHeader(
            'Set-Cookie',
            cookiesToSet.map(({ name, value, options }) =>
              serializeCookieHeader(name, value, options)
            )
          )
        },
      },
      cookieOptions: {
        domain: process.env.NEXT_PUBLIC_CO_DEV_ENV === "preview" ? ".preview.co.dev" : undefined,
      }
    }
  )

  return supabase
}
import { createClient } from '@/util/supabase/static-props'

export default function PublicPage({ data }: { data?: any[] }) {
  return <pre>{data && JSON.stringify(data, null, 2)}</pre>
}

export async function getStaticProps() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { props: {} };
  }

  const supabase = createClient()

  const { data, error } = await supabase.from('countries').select()

  if (error || !data) {
    return { props: {} }
  }

  return { props: { data } }
}
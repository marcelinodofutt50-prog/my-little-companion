import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/tutorials')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const id = url.searchParams.get('id')
        
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        if (id) {
          const { data, error } = await supabaseAdmin
            .from('tutorials')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .maybeSingle()

          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
          if (!data) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
          
          return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
        }

        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = parseInt(url.searchParams.get('limit') || '12')
        const category = url.searchParams.get('category')
        const search = url.searchParams.get('search')
        const orderBy = url.searchParams.get('orderBy') || 'created_at'
        const orderDir = url.searchParams.get('orderDir') || 'desc'

        let query = supabaseAdmin
          .from('tutorials')
          .select('*', { count: 'exact' })
          .eq('is_active', true)

        if (category && category !== 'Tudo') query = query.eq('category', category)
        if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

        const from = (page - 1) * limit
        const to = from + limit - 1

        query = query.order(orderBy, { ascending: orderDir === 'asc' }).range(from, to)

        const { data: tutorials, error: listError, count } = await query

        if (listError) return new Response(JSON.stringify({ error: listError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

        return new Response(JSON.stringify({
          items: tutorials ?? [],
          total: count ?? 0,
          page,
          limit
        }), { headers: { 'Content-Type': 'application/json' } })
      }
    }
  }
})

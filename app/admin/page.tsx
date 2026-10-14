import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase, type Category, type MenuItem, type Tenant } from '@/lib/supabase'
import LoyaltyModal from '@/components/LoyaltyModal'

export const revalidate = 60 // el menú se refresca como máximo cada 60 s

type Params = Promise<{ slug: string }>

const money = new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' })

const getTenant = cache(async (slug: string) => {
  const { data } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, plan_type')
    .eq('slug', slug)
    .maybeSingle()
  return data as Tenant | null
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant(slug)
  return { title: tenant ? `${tenant.name} · Menú` : 'Menú no encontrado' }
}

export default async function MenuPage({ params }: { params: Params }) {
  const { slug } = await params
  const tenant = await getTenant(slug)
  if (!tenant) notFound()

  const [{ data: cats }, { data: menu }] = await Promise.all([
    supabase.from('categories').select('*').eq('tenant_id', tenant.id).order('display_order'),
    supabase.from('menu_items').select('*').eq('tenant_id', tenant.id).order('name'),
  ])

  const categories = (cats ?? []) as Category[]
  const items = (menu ?? []) as MenuItem[]

  const sections = categories
    .map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.category_id === c.id) }))
    .filter((s) => s.items.length > 0)

  const knownIds = new Set(categories.map((c) => c.id))
  const others = items.filter((i) => !i.category_id || !knownIds.has(i.category_id))
  if (others.length > 0) sections.push({ id: 'otros', name: 'Otros', items: others })

  return (
    <div className="min-h-screen scroll-smooth bg-gray-50 pb-28">
      <header className="bg-white px-4 pb-4 pt-8 text-center shadow-sm">
        {tenant.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logo_url}
            alt={`Logo de ${tenant.name}`}
            className="mx-auto mb-3 h-20 w-20 rounded-full object-cover ring-2 ring-amber-200"
          />
        )}
        <h1 className="text-2xl font-extrabold text-gray-900">{tenant.name}</h1>
        <p className="text-sm text-gray-500">Nuestro menú</p>
      </header>

      {sections.length > 0 && (
        <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
          <ul className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
            {sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#cat-${s.id}`}
                  className="block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 active:bg-amber-500 active:text-white"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        {sections.length === 0 && (
          <p className="py-16 text-center text-gray-500">El menú se está preparando. ¡Vuelve pronto!</p>
        )}

        {sections.map((section) => (
          <section key={section.id} id={`cat-${section.id}`} className="scroll-mt-20">
            <h2 className="mb-3 text-xl font-bold text-gray-900">{section.name}</h2>
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className={`flex gap-3 rounded-2xl bg-white p-3 shadow-sm ${
                    item.is_available ? '' : 'opacity-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.description && (
                      <p className="mt-1 line-clamp-3 text-sm text-gray-500">{item.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-bold text-amber-600">{money.format(item.price)}</span>
                      {!item.is_available && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                          Agotado
                        </span>
                      )}
                    </div>
                  </div>
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="h-24 w-24 shrink-0 rounded-xl object-cover"
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <LoyaltyModal tenant={{ id: tenant.id, name: tenant.name, plan_type: tenant.plan_type }} />
    </div>
  )
}

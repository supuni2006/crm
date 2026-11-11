import { Building2, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { CompanyForm } from '../components/forms'
import { Button, CompanyMark, EmptyState, Input, PageHeader, Skeleton } from '../components/ui'
import { useCompanies } from '../lib/api'
import { moneyCompact } from '../lib/format'

export function Companies() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useCompanies(q)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-8">
      <PageHeader
        title="Companies"
        subtitle={data ? `${data.items.length} ${data.items.length === 1 ? 'company' : 'companies'}` : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus />
            New company
          </Button>
        }
      />
      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies" className="pl-9" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-card" />)}
        {data?.items.map((c) => (
          <Link
            key={c.id}
            to={`/companies/${c.id}`}
            className="flex h-[132px] flex-col justify-between rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-card"
          >
            <div className="flex items-start gap-3">
              <CompanyMark name={c.name} hue={c.hue} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold">{c.name}</p>
                <p className="truncate text-[12.5px] text-faint">{c.domain ?? c.industry ?? 'No website'}</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-[12.5px]">
              <div>
                <dt className="text-faint">People</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{c.contactCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-faint">Open deals</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{c.dealCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-faint">Pipeline</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{moneyCompact(c.openValue ?? 0)}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
      {data && data.items.length === 0 && (
        <EmptyState
          icon={<Building2 />}
          title={q ? 'No companies match' : 'No companies yet'}
          description={q ? 'Try a different name.' : 'Companies group contacts and deals together.'}
          action={
            !q && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus />
                New company
              </Button>
            )
          }
        />
      )}
      <CompanyForm open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/companies/${c.id}`)} />
    </div>
  )
}

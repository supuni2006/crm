import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { ContactForm, statusLabel, statusTone } from '../components/forms'
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, Input, Menu, PageHeader, Select, Skeleton } from '../components/ui'
import { api, useApiMutation, useContacts } from '../lib/api'
import { cx } from '../lib/cx'
import { relativeTime } from '../lib/format'
import { CONTACT_STATUSES, type Contact } from '../../shared/types'

export function Contacts() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const sort = (params.get('sort') as 'activity' | 'name') ?? 'activity'
  const page = Number(params.get('page') ?? 0)
  const { data, isLoading, isFetching } = useContacts({ q, status, sort, page })
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Contact | undefined>()
  const [deleting, setDeleting] = useState<Contact | undefined>()
  const remove = useApiMutation((id: string) => api(`/contacts/${id}`, { method: 'DELETE' }), ['contacts', 'companies', 'deals', 'overview'], {
    onSuccess: () => setDeleting(undefined),
  })

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) v ? merged.set(k, v) : merged.delete(k)
    if (!('page' in next)) merged.delete('page')
    setParams(merged, { replace: true })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-8">
      <PageHeader
        title="Contacts"
        subtitle={data ? `${data.total} ${data.total === 1 ? 'person' : 'people'}` : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus />
            New contact
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input type="search" value={q} onChange={(e) => update({ q: e.target.value })} placeholder="Search by name, email or company" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => update({ status: e.target.value })} className="w-[150px]">
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => update({ sort: e.target.value })} className="w-[160px]">
          <option value="activity">Recent activity</option>
          <option value="name">Name</option>
        </Select>
      </div>

      <div className={cx('mt-4 overflow-hidden rounded-card border border-line transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        <table className="w-full table-fixed border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="h-10 border-b border-line bg-bg/60 text-[12.5px] font-medium text-muted">
              <th className="w-[34%] px-4 font-medium">Name</th>
              <th className="hidden w-[22%] px-4 font-medium md:table-cell">Company</th>
              <th className="hidden w-[20%] px-4 font-medium lg:table-cell">Email</th>
              <th className="w-[14%] px-4 font-medium">Status</th>
              <th className="hidden w-[14%] px-4 font-medium sm:table-cell">Activity</th>
              <th className="w-12 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="h-14">
                  <td className="px-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="round size-8" />
                      <Skeleton className="h-3.5 w-40" />
                    </div>
                  </td>
                  <td className="hidden px-4 md:table-cell">
                    <Skeleton className="h-3.5 w-28" />
                  </td>
                  <td className="hidden px-4 lg:table-cell">
                    <Skeleton className="h-3.5 w-36" />
                  </td>
                  <td className="px-4">
                    <Skeleton className="h-6 w-16" />
                  </td>
                  <td className="hidden px-4 sm:table-cell">
                    <Skeleton className="h-3.5 w-12" />
                  </td>
                  <td />
                </tr>
              ))}
            {data?.items.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/contacts/${c.id}`)}
                className="h-14 cursor-pointer transition-colors hover:bg-surface-2/60"
              >
                <td className="px-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={`${c.firstName} ${c.lastName}`} hue={c.hue} src={c.avatarKey ? `/api/files/avatar/${c.id}` : null} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.firstName} {c.lastName}
                      </p>
                      {c.title && <p className="truncate text-[12.5px] text-faint">{c.title}</p>}
                    </div>
                  </div>
                </td>
                <td className="hidden truncate px-4 text-muted md:table-cell">{c.companyName ?? <span className="text-faint">None</span>}</td>
                <td className="hidden truncate px-4 text-muted lg:table-cell">{c.email}</td>
                <td className="px-4">
                  <Badge tone={statusTone[c.status]} dot>
                    {statusLabel[c.status]}
                  </Badge>
                </td>
                <td className="hidden px-4 tabular-nums text-muted sm:table-cell">{relativeTime(c.lastActivityAt)}</td>
                <td className="px-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <Menu
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="More">
                        <MoreHorizontal />
                      </Button>
                    }
                    items={[
                      { label: 'Open', onSelect: () => navigate(`/contacts/${c.id}`) },
                      { label: 'Edit', onSelect: () => setEditing(c) },
                      { label: 'Delete', danger: true, onSelect: () => setDeleting(c) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && (
          <EmptyState
            icon={<Users />}
            title={q || status ? 'No contacts match' : 'No contacts yet'}
            description={q || status ? 'Try a different search or clear the filters.' : 'Add your first contact to start tracking relationships.'}
            action={
              q || status ? (
                <Button onClick={() => update({ q: '', status: '' })}>Clear filters</Button>
              ) : (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus />
                  New contact
                </Button>
              )
            }
          />
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="icon-sm" disabled={page === 0} onClick={() => update({ page: String(page - 1) })} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button size="icon-sm" disabled={page + 1 >= totalPages} onClick={() => update({ page: String(page + 1) })} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <ContactForm open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/contacts/${c.id}`)} />
      <ContactForm open={Boolean(editing)} initial={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title={`Delete ${deleting?.firstName ?? 'contact'}?`}
        description="Their notes and files are removed too. Deals stay but lose the contact."
      />
    </div>
  )
}

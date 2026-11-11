import { CheckSquare, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { TaskForm } from '../components/forms'
import { Badge, Button, Checkbox, EmptyState, PageHeader, Skeleton } from '../components/ui'
import { api, useApiMutation, useTasks } from '../lib/api'
import { cx } from '../lib/cx'
import { dueLabel } from '../lib/format'
import type { Task } from '../../shared/types'

type Group = { key: string; title: string; items: Task[] }

export function Tasks() {
  const { data, isLoading } = useTasks()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>()
  const toggle = useApiMutation((input: { id: string; done: boolean }) => api(`/tasks/${input.id}`, { method: 'PATCH', json: { done: input.done } }), ['tasks', 'overview'])
  const remove = useApiMutation((id: string) => api(`/tasks/${id}`, { method: 'DELETE' }), ['tasks', 'overview'])

  const items = data?.items ?? []
  const now = Date.now()
  const endOfToday = new Date().setHours(23, 59, 59, 999)
  const endOfWeek = endOfToday + 6 * 86_400_000
  const groups: Group[] = [
    { key: 'overdue', title: 'Overdue', items: items.filter((t) => !t.doneAt && t.dueAt !== null && t.dueAt < now) },
    { key: 'today', title: 'Today', items: items.filter((t) => !t.doneAt && t.dueAt !== null && t.dueAt >= now && t.dueAt <= endOfToday) },
    { key: 'week', title: 'This week', items: items.filter((t) => !t.doneAt && t.dueAt !== null && t.dueAt > endOfToday && t.dueAt <= endOfWeek) },
    { key: 'later', title: 'Later', items: items.filter((t) => !t.doneAt && (t.dueAt === null || t.dueAt > endOfWeek)) },
    { key: 'done', title: 'Done', items: items.filter((t) => t.doneAt) },
  ].filter((g) => g.items.length > 0)

  const openCount = items.filter((t) => !t.doneAt).length

  return (
    <div className="mx-auto max-w-[840px] p-5 sm:p-8">
      <PageHeader
        title="Tasks"
        subtitle={data ? `${openCount} open` : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus />
            New task
          </Button>
        }
      />

      {isLoading && (
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-control" />
          ))}
        </div>
      )}

      {data && items.length === 0 && (
        <EmptyState
          icon={<CheckSquare />}
          title="No tasks yet"
          description="Follow-ups, calls and reminders live here, linked to the people they are about."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus />
              New task
            </Button>
          }
        />
      )}

      <div className="mt-6 flex flex-col gap-7">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className={cx('flex items-center gap-2 text-[13px] font-semibold', g.key === 'overdue' && 'text-danger')}>
              {g.title}
              <span className="font-normal tabular-nums text-faint">{g.items.length}</span>
            </h2>
            <ul className="mt-2 divide-y divide-line rounded-card border border-line">
              {g.items.map((t) => {
                const due = dueLabel(t.dueAt)
                return (
                  <li key={t.id} className="group flex h-13 items-center gap-3 px-3">
                    <Checkbox aria-label={`Complete ${t.title}`} checked={Boolean(t.doneAt)} onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })} />
                    <button type="button" onClick={() => setEditing(t)} className="min-w-0 flex-1 text-left">
                      <span className={cx('block truncate text-[13.5px]', Boolean(t.doneAt) && 'text-faint line-through')}>{t.title}</span>
                    </button>
                    {t.contactName && (
                      <Link to={`/contacts/${t.contactId}`} className="hidden truncate text-[12.5px] text-muted hover:text-fg sm:block">
                        {t.contactName}
                      </Link>
                    )}
                    {t.dealTitle && !t.contactName && <span className="hidden truncate text-[12.5px] text-muted sm:block">{t.dealTitle}</span>}
                    {!t.doneAt && t.dueAt && <Badge tone={due.tone === 'muted' ? 'neutral' : due.tone}>{due.label}</Badge>}
                    <button
                      type="button"
                      aria-label="Delete task"
                      onClick={() => remove.mutate(t.id)}
                      className="grid size-8 place-items-center rounded-tile text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <TaskForm open={creating} onClose={() => setCreating(false)} />
      <TaskForm open={Boolean(editing)} initial={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}

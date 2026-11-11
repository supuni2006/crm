import { ArrowDownRight, ArrowUpRight, Calendar, FileText, Mail, MessageSquare, Phone, Plus, Sparkles, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { AreaChart, StageBars } from '../components/charts'
import { Badge, Card, Checkbox, PageHeader, Skeleton } from '../components/ui'
import { api, useApiMutation, useMe, useOverview } from '../lib/api'
import { cx } from '../lib/cx'
import { dueLabel, money, relativeTime } from '../lib/format'
import { DEAL_STAGES, type Activity } from '../../shared/types'

const stageTone: Record<string, string> = {
  lead: '#c6c6d2',
  qualified: '#9d99f0',
  proposal: '#5a55de',
  negotiation: '#2f77d1',
  won: '#1d9a66',
  lost: '#d4462f',
}

export const activityIcon: Record<Activity['kind'], ReactNode> = {
  note: <MessageSquare />,
  call: <Phone />,
  email: <Mail />,
  meeting: <Calendar />,
  stage: <Sparkles />,
  file: <FileText />,
  created: <Plus />,
}

export function Overview() {
  const { data, isLoading } = useOverview()
  const { data: me } = useMe()
  const toggle = useApiMutation((input: { id: string; done: boolean }) => api(`/tasks/${input.id}`, { method: 'PATCH', json: { done: input.done } }), ['overview', 'tasks'])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = me?.user.name?.split(' ')[0]

  const kpis = data
    ? [
        { label: 'Pipeline', value: money(data.kpis.pipelineValue), hint: `${data.kpis.openDeals} open deals` },
        {
          label: 'Won this month',
          value: money(data.kpis.wonThisMonth),
          delta: data.kpis.wonLastMonth ? (data.kpis.wonThisMonth - data.kpis.wonLastMonth) / data.kpis.wonLastMonth : null,
          hint: 'vs last month',
        },
        { label: 'New contacts', value: String(data.kpis.newContacts), hint: 'last 30 days' },
        { label: 'Tasks due', value: String(data.kpis.tasksDue), hint: 'today and overdue' },
      ]
    : []

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-8">
      <PageHeader title={`${greeting}${first ? `, ${first}` : ''}`} subtitle="Here is where things stand across your pipeline." />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-card" />)
          : kpis.map((kpi) => (
              <Card key={kpi.label} className="flex h-[104px] flex-col justify-between p-4">
                <p className="text-[13px] text-muted">{kpi.label}</p>
                <div>
                  <p className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{kpi.value}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-faint">
                    {kpi.delta !== undefined && kpi.delta !== null && (
                      <span className={cx('inline-flex items-center font-medium', kpi.delta >= 0 ? 'text-success' : 'text-danger')}>
                        {kpi.delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        {Math.abs(Math.round(kpi.delta * 100))}%
                      </span>
                    )}
                    {kpi.hint}
                  </p>
                </div>
              </Card>
            ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Revenue</h2>
            <span className="text-[12.5px] text-faint">Won deals, last 6 months</span>
          </div>
          <div className="mt-4">{data ? <AreaChart data={data.revenueSeries} /> : <Skeleton className="h-[220px]" />}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">By stage</h2>
            <Link to="/deals" className="text-[12.5px] text-muted hover:text-fg">
              Open board
            </Link>
          </div>
          <div className="mt-5">
            {data ? (
              <StageBars
                data={data.stageTotals.map((s) => ({
                  label: DEAL_STAGES.find((d) => d.key === s.stage)?.label ?? s.stage,
                  value: s.value,
                  count: s.count,
                  tone: stageTone[s.stage],
                }))}
              />
            ) : (
              <Skeleton className="h-[200px]" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Recent activity</h2>
            <Link to="/contacts" className="text-[12.5px] text-muted hover:text-fg">
              All contacts
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {data?.recentActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[9px] bg-surface-2 text-muted [&_svg]:size-3.5">{activityIcon[a.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]">
                    {a.contactName && (
                      <Link to={`/contacts/${a.contactId}`} className="font-medium hover:underline">
                        {a.contactName}
                      </Link>
                    )}
                    {a.contactName && a.dealTitle && <span className="text-faint"> on </span>}
                    {a.dealTitle && (
                      <Link to={`/deals?deal=${a.dealId}`} className="font-medium hover:underline">
                        {a.dealTitle}
                      </Link>
                    )}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{a.body}</p>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-faint">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
            {data && data.recentActivity.length === 0 && <li className="py-8 text-center text-[13px] text-muted">No activity yet</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Up next</h2>
            <Link to="/tasks" className="text-[12.5px] text-muted hover:text-fg">
              All tasks
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {data?.upcomingTasks.map((t) => {
              const due = dueLabel(t.dueAt)
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <Checkbox aria-label={`Complete ${t.title}`} checked={Boolean(t.doneAt)} onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px]">{t.title}</p>
                    {(t.contactName || t.dealTitle) && <p className="truncate text-[12.5px] text-faint">{t.contactName ?? t.dealTitle}</p>}
                  </div>
                  <Badge tone={due.tone === 'muted' ? 'neutral' : due.tone}>{due.label}</Badge>
                </li>
              )
            })}
            {data && data.upcomingTasks.length === 0 && (
              <li className="flex flex-col items-center py-8 text-center">
                <Users className="size-5 text-faint" />
                <p className="mt-2 text-[13px] text-muted">You are all caught up</p>
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  )
}

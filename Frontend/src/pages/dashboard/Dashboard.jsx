/**
 * Dashboard.jsx
 * ---------------------------------------------------------------------
 * The landing section after login. Pulls everything from ONE call to
 * dashboardService's /overview endpoint (see backend comments on why),
 * then renders the four sub-sections the brief describes: Payments,
 * Sales Pipeline, Today's Tasks, Upcoming Reminders/Follow-ups.
 */

import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, CheckSquare, BellRing, CalendarClock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../api/notifications';
import { useToast } from '../../context/ToastContext';
import StatCard from '../../components/ui/StatCard';
import { Badge, EmptyState, Spinner } from '../../components/ui/atoms';
import DatePicker from '../../components/ui/DatePicker';
import Dropdown from '../../components/ui/Dropdown';

function greetingForHour() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const TASK_STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', completed: 'Completed' };

const PIPELINE_VIEW_OPTIONS = [
  { value: 'projects', label: 'Projects' },
  { value: 'leads', label: 'Leads' },
  { value: 'clients', label: 'Clients' },
];
const PIPELINE_COLORS = ['#726B63', '#D2540A', '#3D7A5D', '#C1440E', '#9C3D07', '#F0895A'];

export default function Dashboard() {
  const { user } = useAuth();
  const { showError } = useToast();
  const [data, setData] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pipelineView, setPipelineView] = useState('projects');
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    const params = { pipelineView };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    try {
      setData(await dashboardApi.overview(params));
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, pipelineView]);

  const currency = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ---- Greeting ---------------------------------------------------- */}
      <div>
        <h1 className="font-display text-3xl font-medium text-ink dark:text-ink-invert">
          {greetingForHour()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-ink-invert/60">
          Here's what's happening across your business today.
        </p>
      </div>

      {/* ---- Payments ------------------------------------------------------ */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink dark:text-ink-invert">
            <Wallet size={18} className="text-brass" /> Payments
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-36" />
            <span className="text-ink-soft">to</span>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" className="w-36" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Amount" value={currency(data.payments.totalAmount)} icon={Wallet} />
          <StatCard label="Total Paid" value={currency(data.payments.totalPaid)} icon={Wallet} tone="success" />
          <StatCard label="Total Balance" value={currency(data.payments.totalBalance)} icon={Wallet} tone="danger" />
        </div>
      </section>

      {/* ---- Sales pipeline -------------------------------------------------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink dark:text-ink-invert">
            <TrendingUp size={18} className="text-brass" /> Sales Pipeline
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
              View by
            </span>
            <Dropdown value={pipelineView} onChange={setPipelineView} options={PIPELINE_VIEW_OPTIONS} className="w-36" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {data.salesPipeline.segments.map((seg, i) => (
            <StatCard
              key={seg.key}
              label={seg.label}
              value={seg.count}
              tone={i === 0 ? 'default' : i === data.salesPipeline.segments.length - 1 ? 'success' : 'brass'}
            />
          ))}
          {pipelineView === 'projects' ? (
            <StatCard
              label="Completion Rate"
              value={
                data.salesPipeline.total
                  ? `${Math.round(((data.salesPipeline.segments.find((s) => s.key === 'completed')?.count || 0) / data.salesPipeline.total) * 100)}%`
                  : '0%'
              }
            />
          ) : (
            <StatCard label="Total" value={data.salesPipeline.total} />
          )}
        </div>
        {data.salesPipeline.total > 0 && (
          <div className="mt-4 h-48 rounded-xl border border-line p-4 dark:border-line-dark">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.salesPipeline.segments.map((s) => ({ stage: s.label, count: s.count }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#EBE3D8" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#726B63' }} axisLine={false} tickLine={false} interval={0} angle={data.salesPipeline.segments.length > 4 ? -20 : 0} textAnchor={data.salesPipeline.segments.length > 4 ? 'end' : 'middle'} height={data.salesPipeline.segments.length > 4 ? 44 : 24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#726B63' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#EBE3D8' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.salesPipeline.segments.map((_, i) => (
                    <Cell key={i} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* ---- Today's tasks ------------------------------------------------- */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-medium text-ink dark:text-ink-invert">
            <CheckSquare size={18} className="text-brass" /> Today's Tasks
          </h2>
          {data.todaysTasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Nothing due today" description="Enjoy the clear runway." />
          ) : (
            <div className="divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
              {data.todaysTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        task.isOverdue ? 'text-danger' : 'text-ink dark:text-ink-invert'
                      }`}
                    >
                      {task.name}
                    </p>
                    <p className="text-xs text-ink-soft dark:text-ink-invert/50">
                      {task.projectName || 'No project'} &middot; {task.startDate} to {task.endDate}
                    </p>
                  </div>
                  <Badge tone={task.isOverdue ? 'danger' : 'neutral'}>{TASK_STATUS_LABEL[task.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- Upcoming reminders / follow-ups ----------------------------- */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-medium text-ink dark:text-ink-invert">
            <BellRing size={18} className="text-brass" /> Upcoming Reminders
          </h2>
          {data.upcomingReminders.leadFollowUps.length === 0 &&
          data.upcomingReminders.meetings.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing coming up" description="No follow-ups or meetings in the next 7 days." />
          ) : (
            <div className="divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
              {data.upcomingReminders.meetings.map((m) => (
                <div key={`meet-${m.id}`} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-ink-invert">{m.title}</p>
                    <p className="text-xs text-ink-soft dark:text-ink-invert/50">
                      Meeting &middot; {m.meeting_date} at {String(m.meeting_time).slice(0, 5)}
                    </p>
                  </div>
                  <Badge tone="brass">Meeting</Badge>
                </div>
              ))}
              {data.upcomingReminders.leadFollowUps.map((l) => (
                <div key={`lead-${l.id}`} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-ink-invert">{l.name}</p>
                    <p className="text-xs text-ink-soft dark:text-ink-invert/50">
                      Follow up &middot; {new Date(l.next_followup_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone="warning">Follow-up</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

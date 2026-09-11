/**
 * MeetingHistory.jsx
 * ---------------------------------------------------------------------
 * Every COMPLETED meeting (past meetings are auto-marked completed by
 * meetingService -- see meetingController.autoCompletePastMeetings),
 * with a Title / Date / Duration list, a search bar, a date filter, and
 * a Lead/Project/Client filter -- built with the exact same
 * SearchFilterBar + Dropdown components used on the Leads section, per
 * the design brief.
 */

import { useEffect, useMemo, useState } from 'react';
import { History, Clock, Video } from 'lucide-react';
import { meetingsApi } from '../../api/meetings';
import { clientsApi } from '../../api/clients';
import { projectsApi } from '../../api/projects';
import { leadsApi } from '../../api/leads';
import { useToast } from '../../context/ToastContext';
import { PageHeader, EmptyState, Spinner, Badge } from '../../components/ui/atoms';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import DatePicker from '../../components/ui/DatePicker';
import Dropdown from '../../components/ui/Dropdown';

const ENTITY_TYPES = [
  { value: 'lead', label: 'Lead' },
  { value: 'project', label: 'Project' },
  { value: 'client', label: 'Client' },
];

export default function MeetingHistory() {
  const { showError } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');

  async function loadFilters() {
    try {
      const [c, p, l] = await Promise.all([clientsApi.list(), projectsApi.lookup(), leadsApi.lookup()]);
      setClients(c);
      setProjects(p);
      setLeads(l);
    } catch (err) {
      showError(err);
    }
  }

  async function loadHistory() {
    setIsLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (entityType && entityId) {
        params.entityType = entityType;
        params.entityId = entityId;
      }
      setMeetings(await meetingsApi.history(params));
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(loadHistory, search ? 300 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFrom, dateTo, entityType, entityId]);

  const entityOptions = useMemo(() => {
    if (entityType === 'lead') return leads.map((l) => ({ value: l.id, label: l.name }));
    if (entityType === 'project') return projects.map((p) => ({ value: p.id, label: p.name }));
    if (entityType === 'client') return clients.map((c) => ({ value: c.id, label: c.name }));
    return [];
  }, [entityType, leads, projects, clients]);

  return (
    <div>
      <PageHeader
        icon={History}
        title="Meeting History"
        description="Every completed meeting, searchable and filterable by lead, project, or client."
      />

      <div className="mb-5 space-y-3 rounded-xl border border-line p-4 dark:border-line-dark">
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search meeting titles..."
          filters={[
            {
              name: 'entityType',
              value: entityType,
              onChange: (val) => {
                setEntityType(val);
                setEntityId('');
              },
              placeholder: 'Filter by...',
              options: ENTITY_TYPES,
            },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
            Date range
          </span>
          <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-40" />
          <span className="text-ink-soft">to</span>
          <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" className="w-40" />
          {entityType && (
            <>
              <span className="ml-2 text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
                {entityType === 'lead' ? 'Lead' : entityType === 'project' ? 'Project' : 'Client'}
              </span>
              <Dropdown
                value={entityId}
                onChange={setEntityId}
                options={entityOptions}
                placeholder={`Choose a ${entityType}`}
                className="w-56"
              />
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={History}
          title="No completed meetings yet"
          description="Meetings move here automatically once their scheduled time has passed."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line dark:border-line-dark">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas-muted text-xs uppercase tracking-wide text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">With</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-canvas-muted/50 dark:hover:bg-canvas-dark-muted/50">
                  <td className="px-4 py-3 font-medium text-ink dark:text-ink-invert">{m.title}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    <div className="flex flex-wrap gap-1">
                      {m.clientName && <Badge tone="brass">{m.clientName}</Badge>}
                      {m.projectName && <Badge tone="neutral">{m.projectName}</Badge>}
                      {m.leadName && <Badge tone="warning">{m.leadName}</Badge>}
                      {!m.clientName && !m.projectName && !m.leadName && '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    {m.meetingDate} at {String(m.meetingTime).slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {m.durationMinutes} min
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.googleMeetLink ? (
                      <a
                        href={m.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brass hover:underline"
                      >
                        <Video size={13} /> Join
                      </a>
                    ) : (
                      <span className="text-ink-soft/50 dark:text-ink-invert/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

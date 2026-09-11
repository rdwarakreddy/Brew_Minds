/**
 * Meetings.jsx
 * ---------------------------------------------------------------------
 * The Google-Calendar-like Meetings section. A meeting can now be
 * linked to a Lead in addition to a Client/Project (a meeting with a
 * prospect who isn't a client yet), and every meeting can be reopened
 * from the calendar to be edited or deleted -- the same detail/edit/
 * delete pattern used on Leads/Clients/Projects.
 */

import { useEffect, useState } from 'react';
import { Plus, CalendarDays, Pencil, Trash2, Video, Clock } from 'lucide-react';
import { meetingsApi } from '../../api/meetings';
import { clientsApi } from '../../api/clients';
import { projectsApi } from '../../api/projects';
import { leadsApi } from '../../api/leads';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import Calendar from '../../components/calendar/Calendar';
import { PageHeader, Spinner, DetailList, Badge, EmptyState } from '../../components/ui/atoms';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { TextField, TextAreaField, SelectField, DateField, TimeField } from '../../components/ui/FormField';

const EMPTY_FORM = {
  title: '',
  clientId: '',
  projectId: '',
  leadId: '',
  meetingDate: '',
  meetingTime: '',
  durationMinutes: 30,
  description: '',
  googleMeetLink: '',
  remindBeforeMinutes: 10,
};

const STATUS_TONE = { scheduled: 'brass', completed: 'success', cancelled: 'danger' };
const STATUS_LABEL = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };

function MeetingForm({ form, setForm, clients, projects, leads, onSubmit, onCancel, isSaving, submitLabel }) {
  // Narrow the Project dropdown to the selected client's projects, and
  // the Lead dropdown works independently -- a meeting can be with a
  // prospect (lead) who isn't tied to any client/project yet at all.
  const projectOptions = projects.filter((p) => !form.clientId || p.client_id === form.clientId);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Meeting Title"
        required
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Client"
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <SelectField
          label="Project"
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          options={[{ value: '', label: 'None' }, ...projectOptions.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <SelectField
          label="Lead"
          value={form.leadId}
          onChange={(e) => setForm({ ...form, leadId: e.target.value })}
          options={[{ value: '', label: 'None' }, ...leads.map((l) => ({ value: l.id, label: l.name }))]}
        />
        <div />
        <DateField
          label="Date"
          required
          value={form.meetingDate}
          onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
        />
        <TimeField
          label="Time"
          required
          value={form.meetingTime}
          onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
        />
      </div>
      <TextField
        label="Duration (minutes)"
        type="number"
        min="5"
        step="5"
        value={form.durationMinutes}
        onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
      />
      <TextField
        label="Google Meet Link"
        placeholder="https://meet.google.com/..."
        value={form.googleMeetLink}
        onChange={(e) => setForm({ ...form, googleMeetLink: e.target.value })}
      />
      <TextAreaField
        label="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <TextField
        label="Remind Me Before (minutes)"
        type="number"
        min="0"
        value={form.remindBeforeMinutes}
        onChange={(e) => setForm({ ...form, remindBeforeMinutes: e.target.value })}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function Meetings() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [meetings, setMeetings] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Detail / edit / delete state -------------------------------------
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function load() {
    setIsLoading(true);
    try {
      const [m, c, p, l] = await Promise.all([
        meetingsApi.list(),
        clientsApi.list(),
        projectsApi.lookup(),
        leadsApi.lookup(),
      ]);
      setMeetings(m);
      setClients(c);
      setProjects(p);
      setLeads(l);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openModalForDay(dateKey) {
    setForm({ ...EMPTY_FORM, meetingDate: dateKey });
    setIsAddOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await meetingsApi.create({
        ...form,
        clientId: form.clientId || null,
        projectId: form.projectId || null,
        leadId: form.leadId || null,
        durationMinutes: Number(form.durationMinutes) || 30,
        remindBeforeMinutes: Number(form.remindBeforeMinutes),
      });
      setIsAddOpen(false);
      setForm(EMPTY_FORM);
      showSuccess('Meeting scheduled.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function openDetail(meeting) {
    setSelectedMeeting(meeting);
    setIsEditing(false);
    setEditForm({
      title: meeting.title,
      clientId: meeting.clientId || '',
      projectId: meeting.projectId || '',
      leadId: meeting.leadId || '',
      meetingDate: meeting.meetingDate,
      meetingTime: String(meeting.meetingTime).slice(0, 5),
      durationMinutes: meeting.durationMinutes ?? 30,
      description: meeting.description || '',
      googleMeetLink: meeting.googleMeetLink || '',
      remindBeforeMinutes: meeting.remindBeforeMinutes ?? 10,
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await meetingsApi.update(selectedMeeting.id, {
        ...editForm,
        clientId: editForm.clientId || null,
        projectId: editForm.projectId || null,
        leadId: editForm.leadId || null,
        durationMinutes: Number(editForm.durationMinutes) || 30,
        remindBeforeMinutes: Number(editForm.remindBeforeMinutes),
      });
      setSelectedMeeting(updated);
      setIsEditing(false);
      showSuccess('Meeting updated.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !(await confirmDelete({
        title: 'Delete this meeting?',
        message: `"${selectedMeeting.title}" will be permanently removed. This cannot be undone.`,
      }))
    )
      return;
    try {
      await meetingsApi.remove(selectedMeeting.id);
      setSelectedMeeting(null);
      showSuccess('Meeting deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  async function handleQuickDelete(e, meeting) {
    e.stopPropagation();
    if (
      !(await confirmDelete({
        title: 'Delete this meeting?',
        message: `"${meeting.title}" will be permanently removed. This cannot be undone.`,
      }))
    )
      return;
    try {
      await meetingsApi.remove(meeting.id);
      showSuccess('Meeting deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  async function handleMarkCancelled() {
    try {
      const updated = await meetingsApi.update(selectedMeeting.id, { status: 'cancelled' });
      setSelectedMeeting(updated);
      showSuccess('Meeting marked as cancelled.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  const scheduledMeetings = meetings
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => `${a.meetingDate}T${a.meetingTime}`.localeCompare(`${b.meetingDate}T${b.meetingTime}`));

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Meetings"
        description="A calendar of every call and check-in with your clients and leads."
        action={
          <Button
            icon={Plus}
            onClick={() => {
              setForm(EMPTY_FORM);
              setIsAddOpen(true);
            }}
          >
            Schedule Meeting
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          {/* ---- Scheduled meetings: an explicit list with inline edit/delete --- */}
          <section className="mb-8">
            <h2 className="mb-3 font-display text-base font-medium text-ink dark:text-ink-invert">
              Scheduled Meetings
            </h2>
            {scheduledMeetings.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No meetings scheduled"
                description='Use "Schedule Meeting" above, or click a day on the calendar below.'
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-line dark:border-line-dark">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas-muted text-xs uppercase tracking-wide text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">With</th>
                      <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line dark:divide-line-dark">
                    {scheduledMeetings.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => openDetail(m)}
                        className="cursor-pointer transition-colors hover:bg-brass/5 dark:hover:bg-canvas-dark-muted/50"
                      >
                        <td className="px-4 py-3 font-medium text-ink dark:text-ink-invert">{m.title}</td>
                        <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                          {m.clientName || m.leadName || m.projectName || '—'}
                        </td>
                        <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                          {m.meetingDate} at {String(m.meetingTime).slice(0, 5)}
                        </td>
                        <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={13} /> {m.durationMinutes} min
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(m);
                                setIsEditing(true);
                              }}
                              className="rounded-full p-1.5 text-ink-soft hover:bg-canvas-muted hover:text-ink dark:hover:bg-canvas-dark-muted"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(e) => handleQuickDelete(e, m)}
                              className="rounded-full p-1.5 text-ink-soft hover:bg-danger/10 hover:text-danger"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </section>

          <Calendar meetings={meetings} onDayClick={openModalForDay} onMeetingClick={openDetail} />
        </>
      )}

      {/* ---- Schedule Meeting modal ------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Schedule a Meeting" size="lg">
        <MeetingForm
          form={form}
          setForm={setForm}
          clients={clients}
          projects={projects}
          leads={leads}
          onSubmit={handleSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Schedule Meeting"
        />
      </Modal>

      {/* ---- Meeting detail / edit / delete modal ------------------------ */}
      <Modal
        isOpen={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        title={isEditing ? `Edit ${selectedMeeting?.title}` : selectedMeeting?.title}
        size="lg"
        headerActions={
          !isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-full p-1.5 text-ink-soft hover:bg-canvas-muted hover:text-ink dark:hover:bg-canvas-dark-muted"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={handleDelete}
                className="rounded-full p-1.5 text-ink-soft hover:bg-danger/10 hover:text-danger"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </>
          )
        }
      >
        {selectedMeeting &&
          (isEditing ? (
            <MeetingForm
              form={editForm}
              setForm={setEditForm}
              clients={clients}
              projects={projects}
              leads={leads}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
              submitLabel="Save Changes"
            />
          ) : (
            <div className="space-y-4">
              <DetailList
                items={[
                  {
                    label: 'Status',
                    value: <Badge tone={STATUS_TONE[selectedMeeting.status]}>{STATUS_LABEL[selectedMeeting.status]}</Badge>,
                  },
                  { label: 'Client', value: selectedMeeting.clientName },
                  { label: 'Project', value: selectedMeeting.projectName },
                  { label: 'Lead', value: selectedMeeting.leadName },
                  { label: 'Date', value: selectedMeeting.meetingDate },
                  { label: 'Time', value: String(selectedMeeting.meetingTime).slice(0, 5) },
                  { label: 'Duration', value: `${selectedMeeting.durationMinutes} minutes` },
                  {
                    label: 'Google Meet',
                    value: selectedMeeting.googleMeetLink ? (
                      <a
                        href={selectedMeeting.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-brass hover:underline"
                      >
                        <Video size={13} /> Join link
                      </a>
                    ) : null,
                  },
                  { label: 'Description', value: selectedMeeting.description },
                  { label: 'Reminder', value: `${selectedMeeting.remindBeforeMinutes} minutes before` },
                ]}
              />
              {selectedMeeting.status === 'scheduled' && (
                <div className="flex justify-end border-t border-line pt-3 dark:border-line-dark">
                  <Button type="button" variant="secondary" size="sm" onClick={handleMarkCancelled}>
                    Mark as Cancelled
                  </Button>
                </div>
              )}
            </div>
          ))}
      </Modal>
    </div>
  );
}

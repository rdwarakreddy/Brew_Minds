/**
 * Leads.jsx
 * ---------------------------------------------------------------------
 * The Leads Kanban board. Two data-loading modes:
 *   - Board view: GET /leads/board, grouped by status, rendered via the
 *     shared KanbanBoard component with drag-and-drop.
 *   - The search bar / filters technically query the flat /leads list
 *     endpoint, but for simplicity and a single consistent board UI we
 *     filter the already-loaded board data client-side here (fast,
 *     since a freelancer's lead count is small -- hundreds, not
 *     millions of rows).
 *
 * Clicking a card opens a detail view (read-only), with Edit and
 * Delete actions in the modal header.
 */

import { useEffect, useState } from 'react';
import { Plus, Target, Phone, Mail, Wallet, Pencil, Trash2 } from 'lucide-react';
import { leadsApi } from '../../api/leads';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import KanbanBoard from '../../components/kanban/KanbanBoard';
import { PageHeader, Spinner, DetailList, Badge } from '../../components/ui/atoms';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { TextField, TextAreaField, SelectField, DateField, TimeField } from '../../components/ui/FormField';

const COLUMNS = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];
const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label]));

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  country: '',
  estimatedBudget: '',
  currency: 'USD',
  status: 'new',
  source: '',
  nextFollowupDate: '',
  nextFollowupTime: '',
  notes: '',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

// Splits an ISO datetime string (from the API) back into separate
// date/time pieces for the two pickers, or blanks if there is none.
function splitFollowup(isoString) {
  if (!isoString) return { nextFollowupDate: '', nextFollowupTime: '' };
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    nextFollowupDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    nextFollowupTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineFollowup(form) {
  return form.nextFollowupDate && form.nextFollowupTime
    ? new Date(`${form.nextFollowupDate}T${form.nextFollowupTime}`).toISOString()
    : null;
}

function LeadCard({ item, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-grab rounded-lg border border-line bg-canvas p-3 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-premium active:cursor-grabbing dark:border-line-dark dark:bg-canvas-dark"
    >
      <p className="text-sm font-medium text-ink dark:text-ink-invert">{item.name}</p>
      {item.email && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft dark:text-ink-invert/50">
          <Mail size={12} /> {item.email}
        </p>
      )}
      {item.phone && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft dark:text-ink-invert/50">
          <Phone size={12} /> {item.phone}
        </p>
      )}
      {item.estimatedBudget != null && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-brass">
          <Wallet size={12} /> {item.currency || 'USD'} {Number(item.estimatedBudget).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function LeadForm({ form, setForm, onSubmit, onCancel, isSaving, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        <TextField
          label="Estimated Budget"
          type="number"
          min="0"
          value={form.estimatedBudget}
          onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })}
        />
        <SelectField
          label="Currency"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
        />
        <TextField
          label="Source"
          placeholder="Referral, LinkedIn, Upwork..."
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
        />
        <div />
        <DateField
          label="Next Follow-up Date"
          value={form.nextFollowupDate}
          onChange={(e) => setForm({ ...form, nextFollowupDate: e.target.value })}
        />
        <TimeField
          label="Next Follow-up Time"
          value={form.nextFollowupTime}
          onChange={(e) => setForm({ ...form, nextFollowupTime: e.target.value })}
        />
      </div>
      <TextAreaField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

export default function Leads() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [board, setBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Detail / edit / delete state -------------------------------------
  const [selectedLead, setSelectedLead] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function load() {
    setIsLoading(true);
    try {
      setBoard(await leadsApi.getBoard());
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMove(leadId, newStatus, newIndex) {
    try {
      await leadsApi.move(leadId, { status: newStatus, boardPosition: newIndex });
    } catch (err) {
      showError(getErrorMessage(err));
      load(); // if the persist fails, reload the true state from the server
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { nextFollowupDate, nextFollowupTime, ...rest } = addForm;
      await leadsApi.create({
        ...rest,
        estimatedBudget: addForm.estimatedBudget ? Number(addForm.estimatedBudget) : null,
        nextFollowupAt: combineFollowup(addForm),
      });
      setIsAddOpen(false);
      setAddForm(EMPTY_FORM);
      showSuccess('Lead added.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function openDetail(lead) {
    setSelectedLead(lead);
    setIsEditing(false);
    setEditForm({
      name: lead.name,
      phone: lead.phone || '',
      email: lead.email || '',
      country: lead.country || '',
      estimatedBudget: lead.estimatedBudget ?? '',
      currency: lead.currency || 'USD',
      status: lead.status,
      source: lead.source || '',
      notes: lead.notes || '',
      ...splitFollowup(lead.nextFollowupAt),
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { nextFollowupDate, nextFollowupTime, ...rest } = editForm;
      const updated = await leadsApi.update(selectedLead.id, {
        ...rest,
        estimatedBudget: editForm.estimatedBudget ? Number(editForm.estimatedBudget) : null,
        nextFollowupAt: combineFollowup(editForm),
      });
      setSelectedLead(updated);
      setIsEditing(false);
      showSuccess('Lead updated.');
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
        title: 'Delete this lead?',
        message: `"${selectedLead.name}" will be permanently removed. This cannot be undone.`,
      }))
    )
      return;
    try {
      await leadsApi.remove(selectedLead.id);
      setSelectedLead(null);
      showSuccess('Lead deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  const filteredBoard = board
    ? Object.fromEntries(
        Object.entries(board).map(([status, items]) => [
          status,
          items.filter((item) => {
            const matchesSearch =
              !search ||
              item.name.toLowerCase().includes(search.toLowerCase()) ||
              item.email?.toLowerCase().includes(search.toLowerCase());
            const matchesSource = !sourceFilter || item.source === sourceFilter;
            return matchesSearch && matchesSource;
          }),
        ])
      )
    : null;

  const sourceOptions = board
    ? [...new Set(Object.values(board).flat().map((l) => l.source).filter(Boolean))].map((s) => ({
        value: s,
        label: s,
      }))
    : [];

  return (
    <div>
      <PageHeader
        icon={Target}
        title="Leads"
        description="Track prospects from first contact through to won or lost."
        action={
          <Button icon={Plus} onClick={() => setIsAddOpen(true)}>
            Add Lead
          </Button>
        }
      />

      <div className="mb-5">
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search leads by name or email..."
          filters={[
            {
              name: 'source',
              value: sourceFilter,
              onChange: setSourceFilter,
              placeholder: 'All sources',
              options: sourceOptions,
            },
          ]}
        />
      </div>

      {isLoading || !filteredBoard ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : (
        <KanbanBoard
          columns={COLUMNS}
          itemsByColumn={filteredBoard}
          renderCard={(item) => <LeadCard item={item} onClick={() => openDetail(item)} />}
          onMove={handleMove}
        />
      )}

      {/* ---- Add Lead modal --------------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Lead" size="lg">
        <LeadForm
          form={addForm}
          setForm={setAddForm}
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Save Lead"
        />
      </Modal>

      {/* ---- Lead detail / edit / delete modal ---------------------------- */}
      <Modal
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={isEditing ? `Edit ${selectedLead?.name}` : selectedLead?.name}
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
        {selectedLead &&
          (isEditing ? (
            <LeadForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
              submitLabel="Save Changes"
            />
          ) : (
            <DetailList
              items={[
                { label: 'Status', value: <Badge tone="brass">{STATUS_LABEL[selectedLead.status]}</Badge> },
                { label: 'Email', value: selectedLead.email },
                { label: 'Phone', value: selectedLead.phone },
                { label: 'Country', value: selectedLead.country },
                {
                  label: 'Est. Budget',
                  value:
                    selectedLead.estimatedBudget != null
                      ? `${selectedLead.currency || 'USD'} ${Number(selectedLead.estimatedBudget).toLocaleString()}`
                      : null,
                },
                { label: 'Source', value: selectedLead.source },
                {
                  label: 'Next Follow-up',
                  value: selectedLead.nextFollowupAt ? new Date(selectedLead.nextFollowupAt).toLocaleString() : null,
                },
                { label: 'Notes', value: selectedLead.notes },
              ]}
            />
          ))}
      </Modal>
    </div>
  );
}

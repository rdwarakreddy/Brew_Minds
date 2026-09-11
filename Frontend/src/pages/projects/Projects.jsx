import { useEffect, useState } from 'react';
import { Plus, Briefcase, Calendar, Wallet, Pencil, Trash2 } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { clientsApi } from '../../api/clients';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import KanbanBoard from '../../components/kanban/KanbanBoard';
import { PageHeader, Spinner, DetailList, Badge } from '../../components/ui/atoms';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { TextField, TextAreaField, SelectField, DateField } from '../../components/ui/FormField';

const COLUMNS = [
  { id: 'new', label: 'New' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];
const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label]));

const EMPTY_FORM = {
  name: '',
  description: '',
  clientId: '',
  status: 'new',
  budget: '',
  currency: 'USD',
  startDate: '',
  endDate: '',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

function ProjectCard({ item, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-grab rounded-lg border border-line bg-canvas p-3 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-premium active:cursor-grabbing dark:border-line-dark dark:bg-canvas-dark"
    >
      <p className="text-sm font-medium text-ink dark:text-ink-invert">{item.name}</p>
      {item.clientName && <p className="mt-1 text-xs text-ink-soft dark:text-ink-invert/50">{item.clientName}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-brass">
          <Wallet size={12} /> {item.currency || 'USD'} {item.budget.toLocaleString()}
        </span>
        {item.endDate && (
          <span className="flex items-center gap-1 text-xs text-ink-soft dark:text-ink-invert/50">
            <Calendar size={12} /> {item.endDate}
          </span>
        )}
      </div>
    </div>
  );
}

function ProjectForm({ form, setForm, clients, onSubmit, onCancel, isSaving, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField label="Project Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <TextAreaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Client"
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          options={[{ value: '', label: 'Select a client' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
        />
        <TextField
          label="Budget"
          type="number"
          min="0"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
        />
        <SelectField
          label="Currency"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <DateField label="Start Date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <DateField label="End Date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
      </div>
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

export default function Projects() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [board, setBoard] = useState(null);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedProject, setSelectedProject] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function load() {
    setIsLoading(true);
    try {
      const [b, c] = await Promise.all([projectsApi.getBoard(), clientsApi.list()]);
      setBoard(b);
      setClients(c);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMove(projectId, newStatus, newIndex) {
    try {
      await projectsApi.move(projectId, { status: newStatus, boardPosition: newIndex });
    } catch (err) {
      showError(getErrorMessage(err));
      load();
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await projectsApi.create({
        ...addForm,
        clientId: addForm.clientId || null,
        budget: addForm.budget ? Number(addForm.budget) : 0,
      });
      setIsAddOpen(false);
      setAddForm(EMPTY_FORM);
      showSuccess('Project added.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function openDetail(project) {
    setSelectedProject(project);
    setIsEditing(false);
    setEditForm({
      name: project.name,
      description: project.description || '',
      clientId: project.clientId || '',
      status: project.status,
      budget: project.budget ?? '',
      currency: project.currency || 'USD',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await projectsApi.update(selectedProject.id, {
        ...editForm,
        clientId: editForm.clientId || null,
        budget: editForm.budget ? Number(editForm.budget) : 0,
      });
      setSelectedProject(updated);
      setIsEditing(false);
      showSuccess('Project updated.');
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
        title: 'Delete this project?',
        message: `"${selectedProject.name}" will be permanently removed. This cannot be undone.`,
      }))
    )
      return;
    try {
      await projectsApi.remove(selectedProject.id);
      setSelectedProject(null);
      showSuccess('Project deleted.');
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
            const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
            const matchesClient = !clientFilter || item.clientId === clientFilter;
            return matchesSearch && matchesClient;
          }),
        ])
      )
    : null;

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        title="Projects"
        description="Every engagement, from kickoff to delivery."
        action={
          <Button icon={Plus} onClick={() => setIsAddOpen(true)}>
            Add Project
          </Button>
        }
      />

      <div className="mb-5">
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search projects..."
          filters={[
            {
              name: 'client',
              value: clientFilter,
              onChange: setClientFilter,
              placeholder: 'All clients',
              options: clients.map((c) => ({ value: c.id, label: c.name })),
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
          renderCard={(item) => <ProjectCard item={item} onClick={() => openDetail(item)} />}
          onMove={handleMove}
        />
      )}

      {/* ---- Add Project modal --------------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Project" size="lg">
        <ProjectForm
          form={addForm}
          setForm={setAddForm}
          clients={clients}
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Save Project"
        />
      </Modal>

      {/* ---- Project detail / edit / delete modal --------------------------- */}
      <Modal
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        title={isEditing ? `Edit ${selectedProject?.name}` : selectedProject?.name}
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
        {selectedProject &&
          (isEditing ? (
            <ProjectForm
              form={editForm}
              setForm={setEditForm}
              clients={clients}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
              submitLabel="Save Changes"
            />
          ) : (
            <DetailList
              items={[
                { label: 'Status', value: <Badge tone="brass">{STATUS_LABEL[selectedProject.status]}</Badge> },
                { label: 'Client', value: selectedProject.clientName },
                { label: 'Description', value: selectedProject.description },
                { label: 'Currency', value: selectedProject.currency },
                { label: 'Budget', value: `${selectedProject.currency} ${Number(selectedProject.budget).toLocaleString()}` },
                { label: 'Paid', value: `${selectedProject.currency} ${Number(selectedProject.paidAmount).toLocaleString()}` },
                { label: 'Due', value: `${selectedProject.currency} ${Number(selectedProject.dueAmount).toLocaleString()}` },
                {
                  label: 'Last Payment',
                  value: selectedProject.lastPayment
                    ? `${selectedProject.currency} ${Number(selectedProject.lastPayment.amount).toLocaleString()} on ${selectedProject.lastPayment.date} · ${selectedProject.lastPayment.status}`
                    : 'No payments logged yet',
                },
                { label: 'Meetings Held', value: selectedProject.meetingsCount ?? 0 },
                { label: 'Start Date', value: selectedProject.startDate },
                { label: 'End Date', value: selectedProject.endDate },
              ]}
            />
          ))}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Plus, CheckSquare, Calendar, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { tasksApi } from '../../api/tasks';
import { projectsApi } from '../../api/projects';
import { clientsApi } from '../../api/clients';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import KanbanBoard from '../../components/kanban/KanbanBoard';
import { PageHeader, Spinner, DetailList, Badge } from '../../components/ui/atoms';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { TextField, SelectField, DateField } from '../../components/ui/FormField';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];
const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label]));

const EMPTY_FORM = { name: '', projectId: '', clientId: '', status: 'todo', startDate: '', endDate: '' };

/**
 * TaskCard
 * Renders in red when `item.isOverdue` (computed server-side, exactly
 * per the brief: a "todo" whose start date has passed, or any
 * non-completed task whose end date has passed).
 */
function TaskCard({ item, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-grab rounded-lg border p-3 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-premium active:cursor-grabbing ${
        item.isOverdue
          ? 'border-danger/40 bg-danger/5'
          : 'border-line bg-canvas dark:border-line-dark dark:bg-canvas-dark'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${item.isOverdue ? 'text-danger' : 'text-ink dark:text-ink-invert'}`}>
          {item.name}
        </p>
        {item.isOverdue && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />}
      </div>
      {item.projectName && (
        <p className="mt-1 text-xs text-ink-soft dark:text-ink-invert/50">{item.projectName}</p>
      )}
      <p
        className={`mt-2 flex items-center gap-1 text-xs ${
          item.isOverdue ? 'text-danger' : 'text-ink-soft dark:text-ink-invert/50'
        }`}
      >
        <Calendar size={12} /> {item.startDate} → {item.endDate}
      </p>
    </div>
  );
}

function TaskForm({ form, setForm, projects, clients, onSubmit, onCancel, isSaving, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField label="Task Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Project"
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          options={[{ value: '', label: 'Select a project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
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
        <div />
        <DateField label="Start Date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <DateField label="End Date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
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

export default function Tasks() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [board, setBoard] = useState(null);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function load() {
    setIsLoading(true);
    try {
      const [b, p, c] = await Promise.all([tasksApi.getBoard(), projectsApi.lookup(), clientsApi.list()]);
      setBoard(b);
      setProjects(p);
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

  async function handleMove(taskId, newStatus, newIndex) {
    try {
      await tasksApi.move(taskId, { status: newStatus, boardPosition: newIndex });
    } catch (err) {
      showError(getErrorMessage(err));
      load();
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await tasksApi.create({ ...addForm, projectId: addForm.projectId || null, clientId: addForm.clientId || null });
      setIsAddOpen(false);
      setAddForm(EMPTY_FORM);
      showSuccess('Task added.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function openDetail(task) {
    setSelectedTask(task);
    setIsEditing(false);
    setEditForm({
      name: task.name,
      projectId: task.projectId || '',
      clientId: task.clientId || '',
      status: task.status,
      startDate: task.startDate,
      endDate: task.endDate,
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await tasksApi.update(selectedTask.id, {
        ...editForm,
        projectId: editForm.projectId || null,
        clientId: editForm.clientId || null,
      });
      setSelectedTask(updated);
      setIsEditing(false);
      showSuccess('Task updated.');
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
        title: 'Delete this task?',
        message: `"${selectedTask.name}" will be permanently removed. This cannot be undone.`,
      }))
    )
      return;
    try {
      await tasksApi.remove(selectedTask.id);
      setSelectedTask(null);
      showSuccess('Task deleted.');
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
            const matchesProject = !projectFilter || item.projectId === projectFilter;
            return matchesSearch && matchesProject;
          }),
        ])
      )
    : null;

  return (
    <div>
      <PageHeader
        icon={CheckSquare}
        title="Tasks"
        description="Overdue tasks are highlighted in red automatically."
        action={
          <Button icon={Plus} onClick={() => setIsAddOpen(true)}>
            Add Task
          </Button>
        }
      />

      <div className="mb-5">
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search tasks..."
          filters={[
            {
              name: 'project',
              value: projectFilter,
              onChange: setProjectFilter,
              placeholder: 'All projects',
              options: projects.map((p) => ({ value: p.id, label: p.name })),
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
          renderCard={(item) => <TaskCard item={item} onClick={() => openDetail(item)} />}
          onMove={handleMove}
        />
      )}

      {/* ---- Add Task modal --------------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Task">
        <TaskForm
          form={addForm}
          setForm={setAddForm}
          projects={projects}
          clients={clients}
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Save Task"
        />
      </Modal>

      {/* ---- Task detail / edit / delete modal ---------------------------- */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={isEditing ? `Edit ${selectedTask?.name}` : selectedTask?.name}
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
        {selectedTask &&
          (isEditing ? (
            <TaskForm
              form={editForm}
              setForm={setEditForm}
              projects={projects}
              clients={clients}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
              submitLabel="Save Changes"
            />
          ) : (
            <DetailList
              items={[
                {
                  label: 'Status',
                  value: (
                    <Badge tone={selectedTask.isOverdue ? 'danger' : 'brass'}>
                      {selectedTask.isOverdue ? 'Overdue' : STATUS_LABEL[selectedTask.status]}
                    </Badge>
                  ),
                },
                { label: 'Project', value: selectedTask.projectName },
                { label: 'Client', value: selectedTask.clientName },
                { label: 'Start Date', value: selectedTask.startDate },
                { label: 'End Date', value: selectedTask.endDate },
              ]}
            />
          ))}
      </Modal>
    </div>
  );
}

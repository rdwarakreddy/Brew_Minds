import { useEffect, useState } from 'react';
import { Plus, Users, Mail, Phone, Globe, Pencil, Trash2 } from 'lucide-react';
import { clientsApi } from '../../api/clients';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { PageHeader, EmptyState, Spinner, DetailList } from '../../components/ui/atoms';
import StatCard from '../../components/ui/StatCard';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { TextField, SelectField } from '../../components/ui/FormField';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];
const EMPTY_FORM = { name: '', phone: '', email: '', invoiceCurrency: 'USD', country: '' };

function ClientForm({ form, setForm, onSubmit, onCancel, isSaving, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Client Name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <TextField
        label="Phone Number"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <TextField
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Invoice Currency"
          value={form.invoiceCurrency}
          onChange={(e) => setForm({ ...form, invoiceCurrency: e.target.value })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <TextField
          label="Country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
        />
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

export default function Clients() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [metrics, setMetrics] = useState(null);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Detail / edit / delete state -------------------------------------
  const [selectedClient, setSelectedClient] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function load() {
    setIsLoading(true);
    try {
      const [m, c] = await Promise.all([clientsApi.metrics(), clientsApi.list({ search })]);
      setMetrics(m);
      setClients(c);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAddSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await clientsApi.create(addForm);
      setIsAddOpen(false);
      setAddForm(EMPTY_FORM);
      showSuccess('Client added.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function openDetail(client) {
    setSelectedClient(client);
    setIsEditing(false);
    setEditForm({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      invoiceCurrency: client.invoiceCurrency,
      country: client.country || '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await clientsApi.update(selectedClient.id, editForm);
      setSelectedClient({ ...selectedClient, ...updated });
      setIsEditing(false);
      showSuccess('Client updated.');
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
        title: `Delete ${selectedClient.name}?`,
        message: 'This will also permanently delete every project under this client. This cannot be undone.',
      }))
    )
      return;
    try {
      await clientsApi.remove(selectedClient.id);
      setSelectedClient(null);
      showSuccess('Client deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Clients"
        description="Everyone you do business with, and how their projects are going."
        action={
          <Button icon={Plus} onClick={() => setIsAddOpen(true)}>
            Add Client
          </Button>
        }
      />

      {metrics && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Clients" value={metrics.totalClients} icon={Users} />
          <StatCard label="Total Projects" value={metrics.totalProjects} />
          <StatCard label="Ongoing" value={metrics.ongoingProjects} tone="brass" />
          <StatCard label="Completed" value={metrics.completedProjects} tone="success" />
        </div>
      )}

      <div className="mb-5">
        <SearchFilterBar search={search} onSearchChange={setSearch} placeholder="Search clients..." />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet" description="Add your first client to start tracking their projects." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line dark:border-line-dark">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas-muted text-xs uppercase tracking-wide text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 font-medium">Projects</th>
                <th className="px-4 py-3 font-medium">Last Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => openDetail(client)}
                  className="cursor-pointer transition-colors hover:bg-brass/5 dark:hover:bg-canvas-dark-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-ink dark:text-ink-invert">{client.name}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    {client.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} /> {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Phone size={13} /> {client.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    <div className="flex items-center gap-1.5">
                      <Globe size={13} /> {client.country || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">{client.invoiceCurrency}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">{client.projectCount}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    {client.lastPayment
                      ? `${client.invoiceCurrency} ${Number(client.lastPayment.amount).toLocaleString()} · ${client.lastPayment.date}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ---- Add Client modal ---------------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Client">
        <ClientForm
          form={addForm}
          setForm={setAddForm}
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Save Client"
        />
      </Modal>

      {/* ---- Client detail / edit / delete modal --------------------------- */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={isEditing ? `Edit ${selectedClient?.name}` : selectedClient?.name}
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
        {selectedClient &&
          (isEditing ? (
            <ClientForm
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
                { label: 'Name', value: selectedClient.name },
                { label: 'Email', value: selectedClient.email },
                { label: 'Phone', value: selectedClient.phone },
                { label: 'Country', value: selectedClient.country },
                { label: 'Invoice Currency', value: selectedClient.invoiceCurrency },
                { label: 'Projects', value: selectedClient.projectCount },
                {
                  label: 'Last Payment',
                  value: selectedClient.lastPayment
                    ? `${selectedClient.invoiceCurrency} ${Number(selectedClient.lastPayment.amount).toLocaleString()} on ${selectedClient.lastPayment.date} · ${selectedClient.lastPayment.status}`
                    : 'No payments logged yet',
                },
              ]}
            />
          ))}
      </Modal>
    </div>
  );
}

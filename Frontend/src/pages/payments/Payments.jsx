/**
 * Payments.jsx
 * ---------------------------------------------------------------------
 * Reminder shown at the top: there is NO payment-gateway integration in
 * this app. Every payment is entered by hand. This section is simply a
 * ledger the freelancer maintains themselves.
 *
 * A payment can cover MULTIPLE projects for the same client (e.g. one
 * transfer that pays for two ongoing engagements at once) -- selecting
 * a client narrows the project checklist to that client's projects, and
 * the Total Amount/Paid/Balance cards recalculate live from whichever
 * project(s) are selected in the filter above the table.
 *
 * Every logged payment can be reopened (click its row) to be edited or
 * deleted -- the same detail/edit/delete pattern used everywhere else
 * in the app.
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Wallet, Info, Pencil, Trash2 } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { projectsApi } from '../../api/projects';
import { clientsApi } from '../../api/clients';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { PageHeader, EmptyState, Spinner, Badge, DetailList } from '../../components/ui/atoms';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import { TextField, SelectField, DateField } from '../../components/ui/FormField';

const EMPTY_FORM = { title: '', amount: '', paymentDate: '', clientId: '', projectIds: [] };

function PaymentForm({ form, setForm, projects, clients, onSubmit, onCancel, isSaving, submitLabel }) {
  const formProjectOptions = useMemo(
    () => projects.filter((p) => !form.clientId || p.client_id === form.clientId),
    [projects, form.clientId]
  );

  function toggleFormProject(projectId) {
    setForm((prev) => ({
      ...prev,
      projectIds: prev.projectIds.includes(projectId)
        ? prev.projectIds.filter((id) => id !== projectId)
        : [...prev.projectIds, projectId],
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Title"
        required
        placeholder="Milestone 1 payment"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          required
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <DateField
          label="Date"
          value={form.paymentDate}
          onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
        />
      </div>
      <SelectField
        label="Client"
        value={form.clientId}
        onChange={(e) => setForm({ ...form, clientId: e.target.value, projectIds: [] })}
        options={[{ value: '', label: 'Select a client' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
      />
      {clients.length === 0 && (
        <p className="-mt-2 text-xs text-ink-soft dark:text-ink-invert/40">
          You don't have any clients yet -- add one in the Clients section first.
        </p>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-ink-invert/60">
          Project(s) this payment covers
        </label>
        {formProjectOptions.length === 0 ? (
          <p className="text-xs text-ink-soft dark:text-ink-invert/40">
            {form.clientId ? 'This client has no projects yet.' : 'Pick a client to see their projects.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {formProjectOptions.map((p) => {
              const active = form.projectIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleFormProject(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-brass bg-brass/10 text-brass-dark dark:text-brass-light'
                      : 'border-line text-ink-soft hover:border-brass/40 dark:border-line-dark dark:text-ink-invert/60'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-ink-soft/70 dark:text-ink-invert/40">
          Select as many projects as this single payment covers.
        </p>
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

export default function Payments() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Filter: which client's/project's totals to inspect above the table.
  const [filterClientId, setFilterClientId] = useState('');
  const [filterProjectIds, setFilterProjectIds] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Detail / edit / delete state -------------------------------------
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function load() {
    setIsLoading(true);
    const params = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (filterProjectIds.length > 0) params.projectIds = filterProjectIds.join(',');
    try {
      const [s, p, proj, cli] = await Promise.all([
        paymentsApi.summary(params),
        paymentsApi.list(params),
        projectsApi.lookup(),
        clientsApi.list(),
      ]);
      setSummary(s);
      setPayments(p);
      setProjects(proj);
      setClients(cli);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, filterProjectIds]);

  // Projects belonging to the client currently selected in the filter row
  // (or all projects, if no client is picked yet).
  const filterProjectOptions = useMemo(
    () => projects.filter((p) => !filterClientId || p.client_id === filterClientId),
    [projects, filterClientId]
  );

  function toggleFilterProject(projectId) {
    setFilterProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await paymentsApi.create({
        ...addForm,
        amount: Number(addForm.amount),
        clientId: addForm.clientId || null,
      });
      setIsAddOpen(false);
      setAddForm(EMPTY_FORM);
      showSuccess('Payment logged.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function openDetail(payment) {
    setSelectedPayment(payment);
    setIsEditing(false);
    setEditForm({
      title: payment.title,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      clientId: payment.clientId || '',
      projectIds: payment.projects.map((p) => p.id),
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await paymentsApi.update(selectedPayment.id, {
        ...editForm,
        amount: Number(editForm.amount),
        clientId: editForm.clientId || null,
      });
      setSelectedPayment(updated);
      setIsEditing(false);
      showSuccess('Payment updated.');
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
        title: 'Delete this payment?',
        message: `"${selectedPayment.title}" will be permanently removed from your ledger. This cannot be undone.`,
      }))
    )
      return;
    try {
      await paymentsApi.remove(selectedPayment.id);
      setSelectedPayment(null);
      showSuccess('Payment deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  const currency = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <PageHeader
        icon={Wallet}
        title="Payments"
        description="A manual ledger of every payment you've received."
        action={
          <Button icon={Plus} onClick={() => setIsAddOpen(true)}>
            Add Payment
          </Button>
        }
      />

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-line bg-canvas-muted px-4 py-3 text-sm text-ink-soft dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert/60">
        <Info size={16} className="mt-0.5 shrink-0 text-brass" />
        <p>
          This app is not connected to any payment provider. Whenever you receive money from a
          client, add it here manually -- the totals below and elsewhere in the app are calculated
          from what you log.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary && (
          <>
            <StatCard label="Total Amount" value={currency(summary.totalAmount)} icon={Wallet} />
            <StatCard label="Total Paid" value={currency(summary.totalPaid)} icon={Wallet} tone="success" />
            <StatCard label="Total Balance" value={currency(summary.totalBalance)} icon={Wallet} tone="danger" />
          </>
        )}
      </div>

      {/* ---- Filters: date range + client/project scoping for the totals above ---- */}
      <div className="mb-5 space-y-3 rounded-xl border border-line p-4 dark:border-line-dark">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
            Date range
          </span>
          <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-40" />
          <span className="text-ink-soft">to</span>
          <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" className="w-40" />
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-ink-invert/50">
            Scope totals to
          </span>
          <SelectField
            value={filterClientId}
            onChange={(e) => {
              setFilterClientId(e.target.value);
              setFilterProjectIds([]); // client changed -> old project selection may not apply anymore
            }}
            options={[{ value: '', label: 'Any client' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            className="w-52"
          />
          <div className="flex flex-1 flex-wrap gap-2">
            {filterProjectOptions.length === 0 ? (
              <span className="py-2 text-xs text-ink-soft dark:text-ink-invert/40">No projects to select yet.</span>
            ) : (
              filterProjectOptions.map((p) => {
                const active = filterProjectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleFilterProject(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-brass bg-brass/10 text-brass-dark dark:text-brass-light'
                        : 'border-line text-ink-soft hover:border-brass/40 dark:border-line-dark dark:text-ink-invert/60'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState icon={Wallet} title="No payments logged yet" description="Add your first payment to start tracking income." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line dark:border-line-dark">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas-muted text-xs uppercase tracking-wide text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Project(s)</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {payments.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openDetail(p)}
                  className="cursor-pointer transition-colors hover:bg-brass/5 dark:hover:bg-canvas-dark-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-ink dark:text-ink-invert">{p.title}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">
                    {p.projects.length === 0 ? (
                      '—'
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.projects.map((proj) => (
                          <Badge key={proj.id} tone="brass">
                            {proj.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">{p.clientName || '—'}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">{p.paymentDate}</td>
                  <td className="px-4 py-3 text-right font-numeric font-semibold text-success">{currency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ---- Add Payment modal ------------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Payment">
        <PaymentForm
          form={addForm}
          setForm={setAddForm}
          projects={projects}
          clients={clients}
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Save Payment"
        />
      </Modal>

      {/* ---- Payment detail / edit / delete modal ------------------------- */}
      <Modal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title={isEditing ? `Edit ${selectedPayment?.title}` : selectedPayment?.title}
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
        {selectedPayment &&
          (isEditing ? (
            <PaymentForm
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
                { label: 'Amount', value: currency(selectedPayment.amount) },
                { label: 'Date', value: selectedPayment.paymentDate },
                { label: 'Client', value: selectedPayment.clientName },
                {
                  label: 'Project(s)',
                  value:
                    selectedPayment.projects.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedPayment.projects.map((proj) => (
                          <Badge key={proj.id} tone="brass">
                            {proj.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null,
                },
              ]}
            />
          ))}
      </Modal>
    </div>
  );
}

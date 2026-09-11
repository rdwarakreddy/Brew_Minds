import { useEffect, useState } from 'react';
import { Plus, Receipt, Download, Pencil, Trash2 } from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { clientsApi } from '../../api/clients';
import { projectsApi } from '../../api/projects';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { PageHeader, EmptyState, Spinner, Badge } from '../../components/ui/atoms';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import InvoiceForm from '../../components/invoice/InvoiceForm';
import { generateInvoicePdf } from '../../utils/generateInvoicePdf';

const STATUS_TONE = { draft: 'neutral', saved: 'brass', paid: 'success' };

export default function Invoices() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Detail / edit / delete state -------------------------------------
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const [inv, c, p] = await Promise.all([
        invoicesApi.list({ search, status: statusFilter }),
        clientsApi.list(),
        projectsApi.lookup(),
      ]);
      setInvoices(inv);
      setClients(c);
      setProjects(p);
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
  }, [search, statusFilter]);

  async function handleSubmit(payload) {
    setIsSaving(true);
    try {
      await invoicesApi.create(payload);
      setIsAddOpen(false);
      showSuccess('Invoice saved.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload(invoiceListRow) {
    try {
      // Fetch the full, authoritative invoice (list rows are summarised)
      const full = await invoicesApi.getOne(invoiceListRow.id);
      await generateInvoicePdf(full);
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  async function openDetail(invoiceListRow) {
    setIsEditing(false);
    setIsDetailLoading(true);
    setSelectedInvoice(invoiceListRow); // show something immediately while the full record loads
    try {
      const full = await invoicesApi.getOne(invoiceListRow.id);
      setSelectedInvoice(full);
    } catch (err) {
      showError(getErrorMessage(err));
      setSelectedInvoice(null);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleEditSubmit(payload) {
    setIsSaving(true);
    try {
      const updated = await invoicesApi.update(selectedInvoice.id, payload);
      setSelectedInvoice(updated);
      setIsEditing(false);
      showSuccess('Invoice updated.');
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
        title: 'Delete this invoice?',
        message: `Invoice ${selectedInvoice.referenceId} will be permanently removed. This cannot be undone.`,
      }))
    )
      return;
    try {
      await invoicesApi.remove(selectedInvoice.id);
      setSelectedInvoice(null);
      showSuccess('Invoice deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  const currency = (n, code) => `${code} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <PageHeader
        icon={Receipt}
        title="Invoices"
        description="A pre-built template -- fill it in, save it, and download a PDF."
        action={
          <Button icon={Plus} onClick={() => setIsAddOpen(true)}>
            New Invoice
          </Button>
        }
      />

      <div className="mb-5">
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by reference ID or client..."
          filters={[
            {
              name: 'status',
              value: statusFilter,
              onChange: setStatusFilter,
              placeholder: 'All statuses',
              options: [
                { value: 'draft', label: 'Draft' },
                { value: 'saved', label: 'Saved' },
                { value: 'paid', label: 'Paid' },
              ],
            },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Create your first invoice to bill a client." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line dark:border-line-dark">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas-muted text-xs uppercase tracking-wide text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Issue Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => openDetail(inv)}
                  className="cursor-pointer transition-colors hover:bg-brass/5 dark:hover:bg-canvas-dark-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-ink dark:text-ink-invert">{inv.referenceId}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">{inv.clientName || '—'}</td>
                  <td className="px-4 py-3 text-ink-soft dark:text-ink-invert/60">{inv.issueDate}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink dark:text-ink-invert">
                    {currency(inv.totalAmount, inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(inv);
                      }}
                      className="inline-flex items-center gap-1 rounded-full p-1.5 text-ink-soft hover:bg-canvas-muted hover:text-ink dark:hover:bg-canvas-dark-muted"
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ---- New Invoice modal --------------------------------------------- */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="New Invoice" size="xl">
        <InvoiceForm
          clients={clients}
          projects={projects}
          onSubmit={handleSubmit}
          onCancel={() => setIsAddOpen(false)}
          isSaving={isSaving}
          submitLabel="Save Invoice"
        />
      </Modal>

      {/* ---- Invoice detail / edit / delete / download modal ---------------- */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={isEditing ? `Edit ${selectedInvoice?.referenceId}` : selectedInvoice?.referenceId}
        size="xl"
        headerActions={
          !isEditing &&
          selectedInvoice && (
            <>
              <button
                onClick={() => handleDownload(selectedInvoice)}
                className="rounded-full p-1.5 text-ink-soft hover:bg-canvas-muted hover:text-ink dark:hover:bg-canvas-dark-muted"
                title="Download PDF"
              >
                <Download size={16} />
              </button>
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
        {isDetailLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : (
          selectedInvoice &&
          (isEditing ? (
            <InvoiceForm
              clients={clients}
              projects={projects}
              initialValues={selectedInvoice}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
              submitLabel="Save Changes"
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone={STATUS_TONE[selectedInvoice.status]}>{selectedInvoice.status}</Badge>
                <span className="text-ink-soft dark:text-ink-invert/60">
                  {selectedInvoice.clientName || 'No client'} &middot; Issued {selectedInvoice.issueDate}
                  {selectedInvoice.dueDate ? ` &middot; Due ${selectedInvoice.dueDate}` : ''}
                </span>
              </div>
              {selectedInvoice.subject && (
                <p className="text-sm text-ink dark:text-ink-invert">{selectedInvoice.subject}</p>
              )}
              <div className="overflow-hidden rounded-lg border border-line dark:border-line-dark">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas-muted text-xs uppercase tracking-wide text-ink-soft dark:bg-canvas-dark-muted dark:text-ink-invert/50">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Rate</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line dark:divide-line-dark">
                    {(selectedInvoice.lineItems || []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-ink dark:text-ink-invert">
                          {item.description}
                          {item.note && <span className="block text-xs italic text-ink-soft dark:text-ink-invert/50">{item.note}</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-ink-soft dark:text-ink-invert/60">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-ink-soft dark:text-ink-invert/60">{item.rate}</td>
                        <td className="px-3 py-2 text-right text-ink dark:text-ink-invert">{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              <div className="ml-auto max-w-xs space-y-1 rounded-lg bg-canvas-muted p-4 text-sm dark:bg-canvas-dark-muted">
                <div className="flex justify-between text-ink-soft dark:text-ink-invert/60">
                  <span>Subtotal</span>
                  <span>{currency(selectedInvoice.subtotalAmount, selectedInvoice.currency)}</span>
                </div>
                {selectedInvoice.gstApplicable && (
                  <div className="flex justify-between text-ink-soft dark:text-ink-invert/60">
                    <span>GST ({selectedInvoice.gstPercentage}%)</span>
                    <span>{currency(selectedInvoice.gstAmount, selectedInvoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-1.5 font-medium text-ink dark:border-line-dark dark:text-ink-invert">
                  <span>Total</span>
                  <span>{currency(selectedInvoice.totalAmount, selectedInvoice.currency)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}

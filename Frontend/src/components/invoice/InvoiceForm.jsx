/**
 * InvoiceForm.jsx
 * ---------------------------------------------------------------------
 * The invoice "template" the user fills in, matching the client-
 * provided design: company logo + name/address header, Bill To +
 * Reference/Issued/Due meta, a Subject line, itemised line items (each
 * with an optional note), GST, a totals box, amount-in-words, Notes and
 * Terms & Conditions, bank details, and an authorized-signature block.
 *
 * Live totals shown here are a PREVIEW only (calculated client-side
 * purely for the user's feedback as they type) -- the numbers that
 * actually get saved and put on the PDF are recalculated authoritatively
 * by invoiceService on submit, so a tampered/buggy client calculation
 * can never save wrong totals.
 */

import { useRef, useState } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { TextField, TextAreaField, SelectField, DateField } from '../ui/FormField';
import Button from '../ui/Button';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];
const EMPTY_ITEM = { description: '', note: '', quantity: 1, rate: 0 };

// Reads a File into a base64 data URL (used for the logo/signature
// uploads) -- kept small/self-contained rather than pulling in a library.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageUploadSlot({ label, dataUrl, onChange, shape = 'square' }) {
  const inputRef = useRef(null);
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-ink-invert/60">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`group relative flex h-20 w-32 cursor-pointer items-center justify-center overflow-hidden border border-dashed border-line bg-canvas-muted transition-colors hover:border-brass dark:border-line-dark dark:bg-canvas-dark-muted ${
          shape === 'circle' ? 'rounded-full !h-20 !w-20' : 'rounded-lg'
        }`}
      >
        {dataUrl ? (
          <img src={dataUrl} alt={label} className="h-full w-full object-contain" />
        ) : (
          <Upload size={18} className="text-ink-soft/50" />
        )}
        {dataUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await fileToDataUrl(file));
        }}
      />
    </div>
  );
}

export default function InvoiceForm({ clients, projects, initialValues, onSubmit, onCancel, isSaving, submitLabel = 'Save Invoice' }) {
  const [clientId, setClientId] = useState(initialValues?.clientId || '');
  const [projectId, setProjectId] = useState(initialValues?.projectId || '');
  const [subject, setSubject] = useState(initialValues?.subject || '');
  const [billToAddress, setBillToAddress] = useState(initialValues?.billToAddress || '');
  const [issuer, setIssuer] = useState(
    initialValues?.issuerDetails || {
      name: 'Brew Minds',
      address: '',
      phone: '',
      email: '',
      bankName: '',
      accountNumber: '',
      ifscOrSwift: '',
    }
  );
  const [logoDataUrl, setLogoDataUrl] = useState(initialValues?.logoDataUrl || null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(initialValues?.signatureDataUrl || null);
  const [signatureName, setSignatureName] = useState(initialValues?.signatureName || 'Authorized Signatory');
  const [items, setItems] = useState(
    initialValues?.lineItems?.length
      ? initialValues.lineItems.map((i) => ({ description: i.description, note: i.note || '', quantity: i.quantity, rate: i.rate }))
      : [{ ...EMPTY_ITEM }]
  );
  const [currency, setCurrency] = useState(initialValues?.currency || 'USD');
  const [gstApplicable, setGstApplicable] = useState(initialValues?.gstApplicable ?? true);
  const [gstPercentage, setGstPercentage] = useState(initialValues?.gstPercentage ?? 18);
  const [dueDate, setDueDate] = useState(initialValues?.dueDate || '');
  const [notes, setNotes] = useState(initialValues?.notes ?? 'Looking forward to working with you.');
  const [terms, setTerms] = useState(initialValues?.terms ?? 'Payment due within 30 days of invoice date.');

  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0);
  const gstAmount = gstApplicable ? (subtotal * Number(gstPercentage || 0)) / 100 : 0;
  const total = subtotal + gstAmount;

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      clientId,
      projectId: projectId || null,
      subject,
      billToAddress,
      issuerDetails: issuer,
      lineItems: items.map((i) => ({
        description: i.description,
        note: i.note,
        quantity: Number(i.quantity),
        rate: Number(i.rate),
      })),
      currency,
      gstApplicable,
      gstPercentage: Number(gstPercentage) || 0,
      dueDate: dueDate || null,
      notes,
      terms,
      logoDataUrl,
      signatureDataUrl,
      signatureName,
      status: 'saved',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ---- Live preview of the dark invoice header, matching the template --- */}
      <div className="overflow-hidden rounded-lg border border-line dark:border-line-dark">
        <div className="flex items-center justify-between bg-panel px-6 py-5">
          <div className="flex items-center gap-4">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="Logo" className="h-14 w-14 rounded object-contain bg-white p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brass font-display text-lg font-bold text-white">
                {(issuer.name || 'BM').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-lg font-semibold text-white">{issuer.name || 'Your Company'}</p>
              <p className="mt-0.5 max-w-xs text-[11px] leading-relaxed text-white/50">
                {issuer.address || 'Company address'}
                {issuer.phone && <><br />{issuer.phone}</>}
                {issuer.email && <> &middot; {issuer.email}</>}
              </p>
            </div>
          </div>
          <span className="font-display text-2xl uppercase tracking-widest text-white/10">Invoice</span>
        </div>
        <div className="h-1 bg-brass" />
      </div>

      {/* ---- Client / project ------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Bill To (Client)"
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          options={[{ value: '', label: 'Select a client' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <SelectField
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={[{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
      </div>
      <TextAreaField
        label="Bill To Address (optional)"
        placeholder="Client's billing address / GSTIN"
        value={billToAddress}
        onChange={(e) => setBillToAddress(e.target.value)}
      />
      <TextField label="Subject" placeholder="e.g. Quotation for Website Redesign" value={subject} onChange={(e) => setSubject(e.target.value)} />

      {/* ---- Issuer (your) details ---------------------------------------- */}
      <fieldset className="rounded-lg border border-line p-4 dark:border-line-dark">
        <legend className="px-1 text-xs font-medium text-ink-soft dark:text-ink-invert/60">Your Details</legend>
        <div className="mb-4 flex gap-4">
          <ImageUploadSlot label="Logo" dataUrl={logoDataUrl} onChange={setLogoDataUrl} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Company Name" value={issuer.name} onChange={(e) => setIssuer({ ...issuer, name: e.target.value })} />
          <TextField label="Phone" value={issuer.phone} onChange={(e) => setIssuer({ ...issuer, phone: e.target.value })} />
          <TextField label="Email" value={issuer.email} onChange={(e) => setIssuer({ ...issuer, email: e.target.value })} />
          <div />
          <TextAreaField
            label="Address"
            className="col-span-2"
            value={issuer.address}
            onChange={(e) => setIssuer({ ...issuer, address: e.target.value })}
          />
        </div>
      </fieldset>

      {/* Currency + GST + due date ------------------------------------------- */}
      <div className="grid grid-cols-3 gap-4">
        <SelectField
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <DateField label="Due Date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <div className="flex items-end gap-2 pb-2.5">
          <input
            id="gst"
            type="checkbox"
            checked={gstApplicable}
            onChange={(e) => setGstApplicable(e.target.checked)}
            className="h-4 w-4 rounded accent-brass"
          />
          <label htmlFor="gst" className="text-sm text-ink dark:text-ink-invert">
            GST Applicable
          </label>
        </div>
      </div>
      {gstApplicable && (
        <TextField
          label="GST Percentage"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={gstPercentage}
          onChange={(e) => setGstPercentage(e.target.value)}
        />
      )}

      {/* ---- Bank details ---------------------------------------------------- */}
      <fieldset className="rounded-lg border border-line p-4 dark:border-line-dark">
        <legend className="px-1 text-xs font-medium text-ink-soft dark:text-ink-invert/60">Bank Details</legend>
        <div className="grid grid-cols-3 gap-4">
          <TextField
            label="Bank Name"
            value={issuer.bankName}
            onChange={(e) => setIssuer({ ...issuer, bankName: e.target.value })}
          />
          <TextField
            label="Account Number"
            value={issuer.accountNumber}
            onChange={(e) => setIssuer({ ...issuer, accountNumber: e.target.value })}
          />
          <TextField
            label="IFSC / SWIFT"
            value={issuer.ifscOrSwift}
            onChange={(e) => setIssuer({ ...issuer, ifscOrSwift: e.target.value })}
          />
        </div>
      </fieldset>

      {/* ---- Line items -------------------------------------------------------- */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-ink-soft dark:text-ink-invert/60">Items</label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() => setItems([...items, { ...EMPTY_ITEM }])}
          >
            Add Item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-line p-3 dark:border-line-dark">
              <div className="grid grid-cols-12 items-center gap-2">
                <input
                  placeholder="Item description"
                  required
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="col-span-6 rounded-lg border border-line bg-canvas px-3 py-2 text-sm dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  className="col-span-2 rounded-lg border border-line bg-canvas px-3 py-2 text-sm dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => updateItem(index, 'rate', e.target.value)}
                  className="col-span-3 rounded-lg border border-line bg-canvas px-3 py-2 text-sm dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert"
                />
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  disabled={items.length === 1}
                  className="col-span-1 flex justify-center text-ink-soft hover:text-danger disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <input
                placeholder="Note (optional) -- e.g. with 1 year warranty"
                value={item.note}
                onChange={(e) => updateItem(index, 'note', e.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs italic text-ink-soft dark:border-line-dark dark:bg-canvas-dark-muted dark:text-ink-invert/60"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ---- Live preview totals ------------------------------------------------ */}
      <div className="rounded-lg bg-canvas-muted p-4 text-sm dark:bg-canvas-dark-muted">
        <div className="flex justify-between text-ink-soft dark:text-ink-invert/60">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        {gstApplicable && (
          <div className="mt-1 flex justify-between text-ink-soft dark:text-ink-invert/60">
            <span>GST ({gstPercentage || 0}%)</span>
            <span>{gstAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium text-ink dark:border-line-dark dark:text-ink-invert">
          <span>Total</span>
          <span>
            {currency} {total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ---- Notes / Terms --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <TextAreaField label="Terms & Conditions" value={terms} onChange={(e) => setTerms(e.target.value)} />
      </div>

      {/* ---- Signature --------------------------------------------------------- */}
      <fieldset className="rounded-lg border border-line p-4 dark:border-line-dark">
        <legend className="px-1 text-xs font-medium text-ink-soft dark:text-ink-invert/60">Signature</legend>
        <div className="flex items-end gap-4">
          <ImageUploadSlot label="Signature Image" dataUrl={signatureDataUrl} onChange={setSignatureDataUrl} />
          <TextField
            label="Signatory Name"
            className="flex-1"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
          />
        </div>
      </fieldset>

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

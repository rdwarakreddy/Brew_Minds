import { useEffect, useState } from 'react';
import { Plus, FileText, Link as LinkIcon, Download, Trash2, File } from 'lucide-react';
import { documentsApi } from '../../api/documents';
import { projectsApi } from '../../api/projects';
import { clientsApi } from '../../api/clients';
import { useToast, getErrorMessage } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { PageHeader, EmptyState, Spinner, Badge } from '../../components/ui/atoms';
import SearchFilterBar from '../../components/ui/SearchFilterBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { TextField, SelectField } from '../../components/ui/FormField';

const EMPTY_LINK_FORM = { name: '', projectId: '', clientId: '', linkUrl: '' };

export default function Documents() {
  const { showError, showSuccess } = useToast();
  const confirmDelete = useConfirm();
  const [documents, setDocuments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docType, setDocType] = useState('file'); // 'file' | 'link'
  const [linkForm, setLinkForm] = useState(EMPTY_LINK_FORM);
  const [fileForm, setFileForm] = useState({ name: '', projectId: '', clientId: '', file: null });
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const [d, p, c] = await Promise.all([
        documentsApi.list({ search, type: typeFilter }),
        projectsApi.lookup(),
        clientsApi.list(),
      ]);
      setDocuments(d);
      setProjects(p);
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
  }, [search, typeFilter]);

  async function handleSubmit(e) {
    e.preventDefault();
    // A Project may only be attached if its Client is also chosen -- a
    // Client alone is fine on its own.
    const activeForm = docType === 'link' ? linkForm : fileForm;
    if (activeForm.projectId && !activeForm.clientId) {
      showError('Select the Client this project belongs to as well.');
      return;
    }
    setIsSaving(true);
    try {
      if (docType === 'link') {
        await documentsApi.createLink(linkForm);
        setLinkForm(EMPTY_LINK_FORM);
      } else {
        if (!fileForm.file) return;
        const formData = new FormData();
        formData.append('file', fileForm.file);
        formData.append('name', fileForm.name);
        if (fileForm.projectId) formData.append('projectId', fileForm.projectId);
        if (fileForm.clientId) formData.append('clientId', fileForm.clientId);
        await documentsApi.createFile(formData);
        setFileForm({ name: '', projectId: '', clientId: '', file: null });
      }
      setIsModalOpen(false);
      showSuccess('Document added.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload(doc) {
    try {
      const response = await documentsApi.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  async function handleDelete(id) {
    if (!(await confirmDelete({ title: 'Delete this document?', message: 'This cannot be undone.' }))) return;
    try {
      await documentsApi.remove(id);
      showSuccess('Document deleted.');
      load();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Documents"
        description="Contracts, quotations, and reference links, all in one place."
        action={
          <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            Add Document
          </Button>
        }
      />

      <div className="mb-5">
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search documents..."
          filters={[
            {
              name: 'type',
              value: typeFilter,
              onChange: setTypeFilter,
              placeholder: 'All types',
              options: [
                { value: 'file', label: 'File' },
                { value: 'link', label: 'Link' },
              ],
            },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Upload a contract or add a link to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-line p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-premium dark:border-line-dark">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {doc.type === 'file' ? (
                    <File size={16} className="text-brass" />
                  ) : (
                    <LinkIcon size={16} className="text-brass" />
                  )}
                  <Badge tone="neutral">{doc.type}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {doc.type === 'file' && (
                    <button
                      onClick={() => handleDownload(doc)}
                      className="rounded-full p-1.5 text-ink-soft hover:bg-canvas-muted hover:text-ink dark:hover:bg-canvas-dark-muted"
                    >
                      <Download size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-full p-1.5 text-ink-soft hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-ink dark:text-ink-invert">{doc.name}</p>
              <p className="mt-1 text-xs text-ink-soft dark:text-ink-invert/50">
                {doc.projectName || 'No project'} {doc.clientName ? `· ${doc.clientName}` : ''}
              </p>
              {doc.type === 'link' && (
                <a
                  href={doc.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block truncate text-xs text-brass hover:underline"
                >
                  {doc.linkUrl}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Document">
        <div className="mb-4 flex overflow-hidden rounded-full border border-line dark:border-line-dark">
          {['file', 'link'].map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                docType === t
                  ? 'bg-ink text-canvas dark:bg-ink-invert dark:text-canvas-dark'
                  : 'text-ink-soft hover:bg-canvas-muted dark:text-ink-invert/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {docType === 'link' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Name"
              required
              value={linkForm.name}
              onChange={(e) => setLinkForm({ ...linkForm, name: e.target.value })}
            />
            <TextField
              label="Link URL"
              type="url"
              required
              placeholder="https://..."
              value={linkForm.linkUrl}
              onChange={(e) => setLinkForm({ ...linkForm, linkUrl: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Client"
                value={linkForm.clientId}
                onChange={(e) => setLinkForm({ ...linkForm, clientId: e.target.value, projectId: '' })}
                options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <SelectField
                label="Project"
                value={linkForm.projectId}
                disabled={!linkForm.clientId}
                onChange={(e) => setLinkForm({ ...linkForm, projectId: e.target.value })}
                options={[
                  { value: '', label: 'None' },
                  ...projects.filter((p) => p.client_id === linkForm.clientId).map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
            <p className="-mt-2 text-xs text-ink-soft dark:text-ink-invert/40">
              A Client can be chosen on its own. A Project can only be chosen once its Client is selected.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Link'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Name"
              placeholder="Defaults to the file's name"
              value={fileForm.name}
              onChange={(e) => setFileForm({ ...fileForm, name: e.target.value })}
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-ink-invert/60">
                File
              </label>
              <input
                type="file"
                required
                onChange={(e) => setFileForm({ ...fileForm, file: e.target.files[0] })}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-medium file:text-canvas dark:text-ink-invert/60 dark:file:bg-ink-invert dark:file:text-canvas-dark"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Client"
                value={fileForm.clientId}
                onChange={(e) => setFileForm({ ...fileForm, clientId: e.target.value, projectId: '' })}
                options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <SelectField
                label="Project"
                value={fileForm.projectId}
                disabled={!fileForm.clientId}
                onChange={(e) => setFileForm({ ...fileForm, projectId: e.target.value })}
                options={[
                  { value: '', label: 'None' },
                  ...projects.filter((p) => p.client_id === fileForm.clientId).map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
            <p className="-mt-2 text-xs text-ink-soft dark:text-ink-invert/40">
              A Client can be chosen on its own. A Project can only be chosen once its Client is selected.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

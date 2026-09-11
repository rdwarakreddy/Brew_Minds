import { apiClient } from './client';

export const invoicesApi = {
  list: (params) => apiClient.get('/invoices', { params }).then((r) => r.data.invoices),
  getOne: (id) => apiClient.get(`/invoices/${id}`).then((r) => r.data.invoice),
  create: (payload) => apiClient.post('/invoices', payload).then((r) => r.data.invoice),
  update: (id, payload) => apiClient.put(`/invoices/${id}`, payload).then((r) => r.data.invoice),
  remove: (id) => apiClient.delete(`/invoices/${id}`),
};

import { apiClient } from './client';

export const clientsApi = {
  metrics: () => apiClient.get('/clients/metrics').then((r) => r.data),
  list: (params) => apiClient.get('/clients', { params }).then((r) => r.data.clients),
  create: (payload) => apiClient.post('/clients', payload).then((r) => r.data.client),
  update: (id, payload) => apiClient.put(`/clients/${id}`, payload).then((r) => r.data.client),
  remove: (id) => apiClient.delete(`/clients/${id}`),
};

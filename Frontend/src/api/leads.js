import { apiClient } from './client';

export const leadsApi = {
  getBoard: () => apiClient.get('/leads/board').then((r) => r.data.board),
  lookup: () => apiClient.get('/leads/lookup').then((r) => r.data.leads),
  list: (params) => apiClient.get('/leads', { params }).then((r) => r.data),
  create: (payload) => apiClient.post('/leads', payload).then((r) => r.data.lead),
  update: (id, payload) => apiClient.put(`/leads/${id}`, payload).then((r) => r.data.lead),
  move: (id, payload) => apiClient.patch(`/leads/${id}/move`, payload).then((r) => r.data.lead),
  remove: (id) => apiClient.delete(`/leads/${id}`),
};

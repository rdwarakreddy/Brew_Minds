import { apiClient } from './client';

export const meetingsApi = {
  list: (params) => apiClient.get('/meetings', { params }).then((r) => r.data.meetings),
  history: (params) => apiClient.get('/meetings/history', { params }).then((r) => r.data.meetings),
  create: (payload) => apiClient.post('/meetings', payload).then((r) => r.data.meeting),
  update: (id, payload) => apiClient.put(`/meetings/${id}`, payload).then((r) => r.data.meeting),
  remove: (id) => apiClient.delete(`/meetings/${id}`),
};

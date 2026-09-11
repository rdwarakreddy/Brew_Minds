import { apiClient } from './client';

export const projectsApi = {
  getBoard: () => apiClient.get('/projects/board').then((r) => r.data.board),
  list: (params) => apiClient.get('/projects', { params }).then((r) => r.data.projects),
  lookup: () => apiClient.get('/projects/lookup').then((r) => r.data.projects),
  create: (payload) => apiClient.post('/projects', payload).then((r) => r.data.project),
  update: (id, payload) => apiClient.put(`/projects/${id}`, payload).then((r) => r.data.project),
  move: (id, payload) => apiClient.patch(`/projects/${id}/move`, payload).then((r) => r.data.project),
  remove: (id) => apiClient.delete(`/projects/${id}`),
};

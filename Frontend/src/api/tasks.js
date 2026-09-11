import { apiClient } from './client';

export const tasksApi = {
  getBoard: () => apiClient.get('/tasks/board').then((r) => r.data.board),
  list: (params) => apiClient.get('/tasks', { params }).then((r) => r.data.tasks),
  today: () => apiClient.get('/tasks/today').then((r) => r.data.tasks),
  create: (payload) => apiClient.post('/tasks', payload).then((r) => r.data.task),
  update: (id, payload) => apiClient.put(`/tasks/${id}`, payload).then((r) => r.data.task),
  move: (id, payload) => apiClient.patch(`/tasks/${id}/move`, payload).then((r) => r.data.task),
  remove: (id) => apiClient.delete(`/tasks/${id}`),
};

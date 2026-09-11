import { apiClient } from './client';

export const paymentsApi = {
  summary: (params) => apiClient.get('/payments/summary', { params }).then((r) => r.data),
  list: (params) => apiClient.get('/payments', { params }).then((r) => r.data.payments),
  create: (payload) => apiClient.post('/payments', payload).then((r) => r.data.payment),
  update: (id, payload) => apiClient.put(`/payments/${id}`, payload).then((r) => r.data.payment),
  remove: (id) => apiClient.delete(`/payments/${id}`),
};

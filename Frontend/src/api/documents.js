import { apiClient } from './client';

export const documentsApi = {
  list: (params) => apiClient.get('/documents', { params }).then((r) => r.data.documents),
  createFile: (formData) =>
    apiClient
      .post('/documents/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.document),
  createLink: (payload) => apiClient.post('/documents/link', payload).then((r) => r.data.document),
  download: (id) => apiClient.get(`/documents/${id}/download`, { responseType: 'blob' }),
  remove: (id) => apiClient.delete(`/documents/${id}`),
};

import { apiClient } from './client';

export const authApi = {
  register: (payload) => apiClient.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => apiClient.post('/auth/login', payload).then((r) => r.data),
  googleAuth: (idToken) => apiClient.post('/auth/google', { idToken }).then((r) => r.data),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken }),
  me: () => apiClient.get('/auth/me').then((r) => r.data.user),
  updateMe: (payload) => apiClient.patch('/auth/me', payload).then((r) => r.data.user),
};

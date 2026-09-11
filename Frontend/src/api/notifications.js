import { apiClient } from './client';

export const notificationsApi = {
  list: () => apiClient.get('/notifications').then((r) => r.data.notifications),
  unreadCount: () => apiClient.get('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
};

export const dashboardApi = {
  overview: (params) => apiClient.get('/dashboard/overview', { params }).then((r) => r.data),
};

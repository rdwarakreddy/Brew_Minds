/**
 * client.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   One shared axios instance used by every api/*.js module. Two
 *   interceptors do all the token bookkeeping so individual components
 *   never have to think about it:
 *
 *   REQUEST interceptor - attaches the current access token to every
 *     outgoing request as `Authorization: Bearer <token>`.
 *
 *   RESPONSE interceptor - if a request comes back 401 with
 *     code === 'TOKEN_EXPIRED', we transparently call /auth/refresh,
 *     store the new tokens, and retry the ORIGINAL request once. The
 *     component that made the call never sees the expired-token error
 *     at all -- the session just silently continues.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({ baseURL: BASE_URL });

// Small helpers around localStorage so token storage logic lives in
// exactly one place. Access + refresh tokens are stored client-side
// because this is a pure SPA talking to a stateless JWT API (no
// server-rendered sessions/cookies involved).
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

function resolvePendingQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isExpired = error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED';

    if (!isExpired || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // A refresh is already in flight (e.g. two requests fired
      // together and both got 401) -- queue this one and retry once
      // the in-flight refresh resolves, instead of firing a second
      // parallel refresh request.
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token available.');

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      resolvePendingQueue(null, data.accessToken);

      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      resolvePendingQueue(refreshError, null);
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

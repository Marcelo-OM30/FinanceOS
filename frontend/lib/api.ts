import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Uma renovação por vez: o dashboard dispara 4 requisições juntas, e as 4
// voltam 401 quando o token expira. Todas esperam a mesma promessa.
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) {
        throw new Error('Sem refresh token');
      }
      // axios puro, não `api`: um 401 aqui não pode disparar outra renovação.
      const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
      const { user, accessToken, refreshToken: novoRefreshToken } = res.data;
      useAuthStore.getState().setAuth(user, accessToken, novoRefreshToken);
      return accessToken as string;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

function endSession() {
  useAuthStore.getState().logout();
  window.location.href = '/login';
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !original || typeof window === 'undefined') {
      return Promise.reject(error);
    }

    // Já renovou e ainda assim levou 401: não adianta tentar de novo.
    if (original._retry) {
      endSession();
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      await refreshAccessToken();
    } catch {
      endSession();
      return Promise.reject(error);
    }
    // O interceptor de request injeta o token novo.
    return api(original);
  }
);

export default api;

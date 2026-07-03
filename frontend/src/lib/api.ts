import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${BASE_URL}/api`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    // Request interceptor — attach token
    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor — handle 401
    this.client.interceptors.response.use(
      (response) => response.data.data ?? response.data,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');

            const res = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
            const { accessToken, refreshToken: newRefresh } = res.data.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefresh);

            original.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(original);
          } catch {
            this.clearAuth();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error.response?.data ?? error);
      },
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private clearAuth() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // ── Auth ──
  auth = {
    register: (data: { email: string; name: string; password: string }) =>
      this.client.post('/auth/register', data),
    login: (data: { email: string; password: string }) =>
      this.client.post('/auth/login', data),
    refresh: (refreshToken: string) =>
      this.client.post('/auth/refresh', { refreshToken }),
    logout: (refreshToken: string) =>
      this.client.post('/auth/logout', { refreshToken }),
    me: () => this.client.post('/auth/me'),
  };

  // ── Organizations ──
  organizations = {
    list: () => this.client.get('/organizations'),
    create: (data: any) => this.client.post('/organizations', data),
    get: (id: string) => this.client.get(`/organizations/${id}`),
    update: (id: string, data: any) => this.client.put(`/organizations/${id}`, data),
    delete: (id: string) => this.client.delete(`/organizations/${id}`),
    listProjects: (orgId: string) => this.client.get(`/organizations/${orgId}/projects`),
    createProject: (orgId: string, data: any) =>
      this.client.post(`/organizations/${orgId}/projects`, data),
  };

  // ── Projects ──
  projects = {
    get: (id: string) => this.client.get(`/projects/${id}`),
    update: (id: string, data: any) => this.client.put(`/projects/${id}`, data),
    delete: (id: string) => this.client.delete(`/projects/${id}`),
    regenerateKey: (id: string) => this.client.post(`/projects/${id}/regenerate-key`),
  };

  // ── Queues ──
  queues = {
    list: (projectId: string) => this.client.get(`/projects/${projectId}/queues`),
    create: (projectId: string, data: any) =>
      this.client.post(`/projects/${projectId}/queues`, data),
    get: (projectId: string, queueId: string) =>
      this.client.get(`/projects/${projectId}/queues/${queueId}`),
    update: (projectId: string, queueId: string, data: any) =>
      this.client.put(`/projects/${projectId}/queues/${queueId}`, data),
    delete: (projectId: string, queueId: string) =>
      this.client.delete(`/projects/${projectId}/queues/${queueId}`),
    pause: (projectId: string, queueId: string) =>
      this.client.post(`/projects/${projectId}/queues/${queueId}/pause`),
    resume: (projectId: string, queueId: string) =>
      this.client.post(`/projects/${projectId}/queues/${queueId}/resume`),
    stats: (projectId: string, queueId: string) =>
      this.client.get(`/projects/${projectId}/queues/${queueId}/stats`),
  };

  // ── Jobs ──
  jobs = {
    list: (queueId: string, params?: Record<string, any>) =>
      this.client.get(`/queues/${queueId}/jobs`, { params }),
    create: (queueId: string, data: any) =>
      this.client.post(`/queues/${queueId}/jobs`, data),
    createBulk: (queueId: string, data: any) =>
      this.client.post(`/queues/${queueId}/jobs/bulk`, data),
    get: (queueId: string, jobId: string) =>
      this.client.get(`/queues/${queueId}/jobs/${jobId}`),
    retry: (queueId: string, jobId: string, data?: any) =>
      this.client.post(`/queues/${queueId}/jobs/${jobId}/retry`, data),
    cancel: (queueId: string, jobId: string, data?: any) =>
      this.client.post(`/queues/${queueId}/jobs/${jobId}/cancel`, data),
    logs: (queueId: string, jobId: string, params?: any) =>
      this.client.get(`/queues/${queueId}/jobs/${jobId}/logs`, { params }),
  };

  // ── DLQ ──
  dlq = {
    list: (projectId: string, params?: any) =>
      this.client.get(`/projects/${projectId}/dlq`, { params }),
    requeue: (projectId: string, dlqId: string) =>
      this.client.post(`/projects/${projectId}/dlq/${dlqId}/requeue`),
  };

  // ── Workers ──
  workers = {
    list: () => this.client.get('/workers'),
    active: () => this.client.get('/workers/active'),
    status: () => this.client.get('/workers/status'),
  };

  // ── Metrics ──
  metrics = {
    dashboard: () => this.client.get('/metrics/dashboard'),
    project: (projectId: string) => this.client.get(`/metrics/project/${projectId}`),
    throughput: (hours?: number) =>
      this.client.get('/metrics/throughput', { params: { hours } }),
  };
}

export const api = new ApiClient();

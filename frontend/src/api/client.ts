import axios from 'axios';

const client = axios.create({
  baseURL: '', // Proxied via Vite
});

// Add interceptor for JWT
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('karma_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;

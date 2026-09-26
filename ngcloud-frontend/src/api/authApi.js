import axiosClient from './axiosClient'

export const authApi = {
  register: (data) => axiosClient.post('/api/auth/register', data),

  login: (data) => axiosClient.post('/api/auth/login', data),

  logout: () => axiosClient.post('/api/auth/logout'),

  me: () => axiosClient.get('/api/auth/me'),

  saveKyberPublicKey: (kyberPublicKey) =>
    axiosClient.post('/api/auth/kyber-public-key', {
      kyberPublicKey,
    }),

  adminLogin: (data) => axiosClient.post('/api/admin/auth/login', data),

  adminRegister: (data) => axiosClient.post('/api/admin/auth/register', data),

  listAdmins: () => axiosClient.get('/api/admin/auth/admins'),

  disableAdmin: (id) => axiosClient.patch(`/api/admin/auth/admins/${id}/disable`),
}
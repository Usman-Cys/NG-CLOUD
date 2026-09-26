import axiosClient from "./axiosClient";

export const adminApi = {
  // Legacy / compatibility methods
  stats: async () => {
    const res = await axiosClient.get('/api/admin/stats');
    return res.data;
  },
  users: async () => {
    const res = await axiosClient.get('/api/admin/users');
    return res.data;
  },
  disableUser: async (id) => {
    const res = await axiosClient.patch(`/api/admin/users/${id}/disable`);
    return res.data;
  },
  deleteUser: async (id, permanent = false) => {
    const res = await axiosClient.delete(`/api/admin/users/${id}${permanent ? '?permanent=true' : ''}`);
    return res.data;
  },
  files: async () => {
    const res = await axiosClient.get('/api/admin/files');
    return res.data;
  },
  deleteFile: async (id, permanent = false) => {
    const res = await axiosClient.delete(`/api/admin/files/${id}${permanent ? '?permanent=true' : ''}`);
    return res.data;
  },
  storage: async () => {
    const res = await axiosClient.get('/api/admin/storage');
    return res.data;
  },
  health: async () => {
    const res = await axiosClient.get('/api/admin/health');
    return res.data;
  },
  security: async () => {
    const res = await axiosClient.get('/api/admin/security');
    return res.data;
  },
  logs: async (params) => {
    const res = await axiosClient.get('/api/admin/logs', { params });
    return res.data;
  },

  // Module 3 Exact Methods
  getStats: async () => {
    const { data } = await axiosClient.get("/api/admin/stats");
    return data;
  },

  getUsers: async () => {
    const { data } = await axiosClient.get("/api/admin/users");
    return data.users || [];
  },

  getFiles: async () => {
    const { data } = await axiosClient.get("/api/admin/files");
    return data.files || [];
  },

  getStorage: async () => {
    const { data } = await axiosClient.get("/api/admin/storage");
    return data;
  },

  getStorageCapacity: async () => {
    const { data } = await axiosClient.get("/api/admin/storage/capacity");
    return data;
  },

  getSecurity: async () => {
    const { data } = await axiosClient.get("/api/admin/security");
    return data.checks || [];
  },

  getLogs: async () => {
    const { data } = await axiosClient.get("/api/admin/logs");
    return data.logs || [];
  },

  getPolicy: async () => {
    const { data } = await axiosClient.get("/api/admin/policy");
    return data.policy;
  },

  updateUserQuota: async (userId, quotaMb) => {
    const { data } = await axiosClient.patch(`/api/admin/users/${userId}/quota`, {
      quotaMb,
    });
    return data;
  },

  updateUserStatus: async (userId, status) => {
    const { data } = await axiosClient.patch(`/api/admin/users/${userId}/status`, {
      status,
    });
    return data;
  },
};

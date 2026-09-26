const TOKEN_KEY = 'ngcloud_token'
const USER_KEY = 'ngcloud_user'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }
export const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null } }
export const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u))

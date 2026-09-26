import { createContext, useContext, useState } from 'react'
import { authApi } from '../api/authApi'
import {
  clearToken,
  getToken,
  getUser,
  setToken,
  setUser as saveUser,
} from '../utils/token'
import {
  generateAndStoreKyberKeys,
  hasLocalKyberPrivateKey,
  getStoredKyberPrivateKey,
} from '../crypto/kyberKeyManager'

const AuthContext = createContext(null)

const demoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(getUser())
  const [token, setTokenState] = useState(getToken())
  const [loading, setLoading] = useState(false)

  const saveAuthState = (jwtToken, authUser) => {
    setToken(jwtToken)
    setTokenState(jwtToken)
    saveUser(authUser)
    setUserState(authUser)
  }

  const setupKyberForUser = async (loggedInUser, password) => {
    if (!loggedInUser?.id) {
      console.warn('Kyber skipped: missing user id')
      return loggedInUser
    }

    const existingPublicKey =
      loggedInUser.kyberPublicKey || loggedInUser.kyber_public_key

    const hasLocalPrivateKey = hasLocalKyberPrivateKey(loggedInUser.id)

    console.log('Kyber check:', {
      userId: loggedInUser.id,
      username: loggedInUser.username,
      hasPublicKey: Boolean(existingPublicKey),
      hasLocalPrivateKey,
    })

    if (existingPublicKey && hasLocalPrivateKey) {
      try {
        await getStoredKyberPrivateKey(loggedInUser.id, password)
        console.log('Kyber already configured and verified for this browser.')
        return loggedInUser
      } catch (err) {
        console.warn('Stored Kyber private key decryption failed with current password. Regenerating keypair...', err)
      }
    }

    console.log('Generating fresh Kyber keypair...')

    const keys = await generateAndStoreKyberKeys(loggedInUser.id, password)

    console.log('Kyber keypair generated. Saving public key to backend...')

    const { data } = await authApi.saveKyberPublicKey(keys.publicKeyBase64)

    console.log('Kyber public key saved:', data)

    return {
      ...loggedInUser,
      ...(data.user || {}),
      kyberPublicKey:
        data.user?.kyberPublicKey ||
        data.user?.kyber_public_key ||
        keys.publicKeyBase64,
      kyber_public_key:
        data.user?.kyber_public_key ||
        data.user?.kyberPublicKey ||
        keys.publicKeyBase64,
    }
  }

  const login = async ({ username, password }) => {
    setLoading(true)

    try {
      if (demoLoginEnabled && username === 'user' && password === 'user123') {
        const demoToken = 'demo-user-token'
        const demoUser = {
          id: 'demo-user-id',
          username: 'user',
          role: 'user',
        }

        saveAuthState(demoToken, demoUser)
        return demoUser
      }

      console.log('Attempting backend login for:', username)

      const { data } = await authApi.login({ username, password })

      console.log('Backend login success:', data)

      const jwtToken = data.token || data.accessToken || data.jwt

      const loggedInUser = data.user || {
        username,
        role: data.role || 'user',
        id: data.userId || data.id,
      }

      if (!jwtToken) {
        throw new Error('Backend did not return a JWT token.')
      }

      // Save token first because /api/auth/kyber-public-key requires JWT.
      setToken(jwtToken)
      setTokenState(jwtToken)

      try {
        console.log('Starting Kyber setup for user:', loggedInUser.id)
        const finalUser = await setupKyberForUser(loggedInUser, password)
        console.log('Kyber setup succeeded. Saving final auth state.')
        saveAuthState(jwtToken, finalUser)
        return finalUser
      } catch (kyberErr) {
        console.error('Kyber setup failed:', kyberErr)
        // Clean up token/user state since login flow has failed
        clearToken()
        setTokenState(null)
        setUserState(null)
        throw kyberErr
      }
    } catch (err) {
      console.error('Login failed:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const adminLogin = async ({ username, password }) => {
    setLoading(true)
    try {
      console.log('Attempting backend admin login for:', username)
      const { data } = await authApi.adminLogin({ username, password })
      console.log('Backend admin login success:', data)
      const jwtToken = data.token
      const loggedInAdmin = data.user
      saveAuthState(jwtToken, loggedInAdmin)
      return loggedInAdmin
    } catch (err) {
      console.error('Admin login failed:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const register = async ({ username, password }) => {
    const { data } = await authApi.register({ username, password })
    return data
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (err) {
      console.warn('Backend logout failed:', err)
    } finally {
      clearToken()
      setUserState(null)
      setTokenState(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        adminLogin,
        register,
        logout,
        isAuthenticated: !!token,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
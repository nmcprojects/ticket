"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, setAuthToken, type AuthUser } from "./api";

const REFRESH_KEY = "th_refresh_token";
const USER_KEY = "th_user";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: { email: string; password: string; fullName: string; phoneNumber?: string }) => Promise<void>;
  logout: () => void;
  updateUser: (u: AuthUser) => void;
  hasRole: (role: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [loading, setLoading] = useState(true);

  // Revalidate the session on first load if we have a token
  useEffect(() => {
    const token = localStorage.getItem("th_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(res: { accessToken: string; refreshToken: string; user: AuthUser }) {
    setAuthToken(res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  function clearSession() {
    setAuthToken(null);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  const login = async (email: string, password: string) => {
    persist(await api.login(email, password));
  };

  const register = async (body: { email: string; password: string; fullName: string; phoneNumber?: string }) => {
    persist(await api.register(body));
  };

  const logout = () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (refresh) api.logout(refresh).catch(() => undefined);
    clearSession();
  };

  const updateUser = (u: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  const hasRole = (role: string) => !!user?.roles?.includes(role);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

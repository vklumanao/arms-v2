import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "@/shared/api/httpClient";
import {
  fetchCurrentSession,
  loginWithPassword,
  logoutSession,
  registerAccount,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/shared/api/authApi";
import { syncRolePermissionMapFromServer } from "@/shared/auth/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const applyAuthPayload = (payload) => {
    const nextUser = payload?.user || null;
    const nextProfile = payload?.profile || null;
    const persistedToken = getAuthToken();
    const nextSession = nextUser
      ? {
          user: nextUser,
          access_token: payload?.token || persistedToken || "cookie_session",
        }
      : null;
    setSession(nextSession);
    setProfile(nextProfile);
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const persistedToken = getAuthToken();
      if (!persistedToken) {
        if (active) {
          setSession(null);
          setProfile(null);
          setProfileLoading(false);
          setLoading(false);
        }
        return;
      }

      setProfileLoading(true);
      try {
        const payload = await fetchCurrentSession();
        if (!active) return;
        applyAuthPayload(payload);
        await syncRolePermissionMapFromServer();
      } catch {
        if (!active) return;
        clearAuthToken();
        setSession(null);
        setProfile(null);
      } finally {
        if (active) {
          setProfileLoading(false);
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (profile?.is_active === false) {
      sessionStorage.setItem("arms_deactivated_notice", "1");
      clearAuthToken();
      setSession(null);
      setProfile(null);
    }
  }, [profile]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      loading,
      profileLoading,
      refreshProfile: async () => {
        setProfileLoading(true);
        try {
          const payload = await fetchCurrentSession();
          applyAuthPayload(payload);
          await syncRolePermissionMapFromServer();
        } finally {
          setProfileLoading(false);
        }
      },
      signIn: async ({ email, password }) => {
        const payload = await loginWithPassword({ email, password });
        if (payload?.token) {
          setAuthToken(payload.token);
        } else {
          clearAuthToken();
        }
        applyAuthPayload(payload);
        await syncRolePermissionMapFromServer();
        return payload;
      },
      register: async (payload) => {
        return registerAccount(payload);
      },
      signOut: async () => {
        try {
          await logoutSession();
        } catch {
          // Ignore logout API errors and clear local state regardless.
        } finally {
          clearAuthToken();
          setSession(null);
          setProfile(null);
        }
      },
      requestPasswordReset: async (email) => {
        return requestPasswordReset(email);
      },
      resetPassword: async ({ token, password }) => {
        return resetPasswordWithToken({ token, password });
      },
    }),
    [session, profile, loading, profileLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}


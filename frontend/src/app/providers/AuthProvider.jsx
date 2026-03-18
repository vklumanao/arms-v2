import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
const SESSION_HINT_KEY = "arms_has_session";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const applyAuthPayload = (payload) => {
    const nextUser = payload?.user || null;
    const nextProfile = payload?.profile || null;
    const nextSession = nextUser
      ? {
          user: nextUser,
          access_token: "cookie_session",
        }
      : null;
    setSession(nextSession);
    setProfile(nextProfile);
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setProfileLoading(true);
      try {
        if (!sessionStorage.getItem(SESSION_HINT_KEY)) {
          setSession(null);
          setProfile(null);
          return;
        }
        const payload = await fetchCurrentSession();
        if (!active) return;
        applyAuthPayload(payload);
        if (payload?.user) {
          await syncRolePermissionMapFromServer();
        }
      } catch {
        if (!active) return;
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
          if (payload?.user) {
            await syncRolePermissionMapFromServer();
          }
        } finally {
          setProfileLoading(false);
        }
      },
      signIn: async ({ email, password }) => {
        const payload = await loginWithPassword({ email, password });
        applyAuthPayload(payload);
        sessionStorage.setItem(SESSION_HINT_KEY, "1");
        await syncRolePermissionMapFromServer();
        return payload;
      },
      register: async (payload) => {
        const authPayload = await registerAccount(payload);
        applyAuthPayload(authPayload);
        sessionStorage.setItem(SESSION_HINT_KEY, "1");
        await syncRolePermissionMapFromServer();
        return authPayload;
      },
      signOut: async () => {
        try {
          await logoutSession();
        } catch {
          // Ignore logout API errors and clear local state regardless.
        } finally {
          setSession(null);
          setProfile(null);
          sessionStorage.removeItem(SESSION_HINT_KEY);
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

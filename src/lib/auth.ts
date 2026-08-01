import { UserRole } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface AuthUser {
  email: string;
  role: UserRole;
  name: string;
}

export const DEMO_CITIZEN_ACCOUNT = {
  email: 'demo.citizen@disasterhub.app',
  password: 'Citizen@123',
  role: 'citizen' as UserRole,
  name: 'Citizen Demo User'
};

export const DEMO_ADMIN_ACCOUNT = {
  email: 'demo.admin@disasterhub.app',
  password: 'Admin@123',
  role: 'admin' as UserRole,
  name: 'Authority Admin User'
};

const USER_STORAGE_KEY = 'disasterhub_auth_user';

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as AuthUser;
    }
  } catch (err) {
    console.warn('Failed to parse stored auth user:', err);
  }
  // Default to citizen demo user if nothing stored
  return {
    email: DEMO_CITIZEN_ACCOUNT.email,
    role: DEMO_CITIZEN_ACCOUNT.role,
    name: DEMO_CITIZEN_ACCOUNT.name
  };
}

export function setStoredAuthUser(user: AuthUser | null): void {
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
  } else {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

/**
 * Fetch profile/role from Supabase session if logged in via Supabase, falling back to stored auth user
 */
export async function getSupabaseUserRole(): Promise<AuthUser | null> {
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch profile from profiles table if present
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        const userRole: UserRole = (profile?.role === 'admin' || session.user.user_metadata?.role === 'admin')
          ? 'admin'
          : 'citizen';

        const user: AuthUser = {
          email: session.user.email || 'user@disasterhub.app',
          role: userRole,
          name: profile?.full_name || session.user.user_metadata?.name || 'Authenticated User'
        };
        setStoredAuthUser(user);
        return user;
      }
    } catch (err) {
      console.warn('Supabase auth session check error:', err);
    }
  }

  return getStoredAuthUser();
}

export async function loginWithDemoCredentials(email: string, pass: string): Promise<{ user?: AuthUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === DEMO_CITIZEN_ACCOUNT.email.toLowerCase() && pass === DEMO_CITIZEN_ACCOUNT.password) {
    const user: AuthUser = {
      email: DEMO_CITIZEN_ACCOUNT.email,
      role: 'citizen',
      name: DEMO_CITIZEN_ACCOUNT.name
    };
    setStoredAuthUser(user);
    return { user };
  }

  if (cleanEmail === DEMO_ADMIN_ACCOUNT.email.toLowerCase() && pass === DEMO_ADMIN_ACCOUNT.password) {
    const user: AuthUser = {
      email: DEMO_ADMIN_ACCOUNT.email,
      role: 'admin',
      name: DEMO_ADMIN_ACCOUNT.name
    };
    setStoredAuthUser(user);
    return { user };
  }

  return {
    error: 'Invalid credentials. Please use one of the accounts listed below.'
  };
}

export async function signUpCitizen(
  name: string,
  email: string,
  pass: string
): Promise<{ user?: AuthUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            full_name: name.trim(),
            name: name.trim(),
            role: 'citizen'
          }
        }
      });
      if (error) {
        console.warn('Supabase signup notice:', error.message);
      } else if (data.user) {
        const user: AuthUser = {
          email: data.user.email || cleanEmail,
          role: 'citizen',
          name: name.trim() || 'Registered Citizen'
        };
        setStoredAuthUser(user);
        return { user };
      }
    } catch (err) {
      console.warn('Supabase signup exception:', err);
    }
  }

  // Fallback for local session
  const user: AuthUser = {
    email: cleanEmail,
    role: 'citizen',
    name: name.trim() || 'Registered Citizen'
  };
  setStoredAuthUser(user);
  return { user };
}


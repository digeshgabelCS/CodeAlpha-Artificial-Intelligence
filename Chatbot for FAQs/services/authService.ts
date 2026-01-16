
import { User } from '../types';

const USER_STORAGE_KEY = 'nexora_user_session';

class AuthService {
  
  /**
   * Checks if a user is currently logged in via localStorage.
   */
  getCurrentUser(): User | null {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse user session", e);
    }
    return null;
  }

  /**
   * Simulates a login API call.
   */
  async login(email: string, password: string): Promise<User> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!email.includes('@') || password.length < 4) {
      throw new Error("Invalid credentials");
    }

    // Retrieve existing user if matches or create mock
    const mockUser: User = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: email.split('@')[0], // Use part of email as name for demo
      email: email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
    };

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  }

  /**
   * Simulates a signup API call.
   */
  async signup(name: string, email: string, password: string, avatar?: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!email.includes('@') || password.length < 4 || !name) {
        throw new Error("Please fill in all fields correctly");
    }

    const mockUser: User = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: name,
      email: email,
      // Use provided avatar or fallback to Dicebear
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
    };

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  }

  /**
   * Logs out the user.
   */
  logout() {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export const authService = new AuthService();


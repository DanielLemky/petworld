const ACCOUNTS_STORAGE_KEY = 'petworld_accounts';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'petworld_active_account';

export interface Account {
  id: string;
  name: string;
  createdAt: number;
}

class AccountManagerClass {
  private accounts: Account[] = [];
  private activeAccountId: string | null = null;
  private nextId: number = 1;

  constructor() {
    this.load();
  }

  // Get all accounts
  getAccounts(): Account[] {
    return [...this.accounts];
  }

  // Create a new account
  createAccount(name: string): Account {
    const account: Account = {
      id: `acc_${this.nextId++}`,
      name: name.trim(),
      createdAt: Date.now(),
    };

    this.accounts.push(account);
    this.save();

    return account;
  }

  // Select an account as active
  selectAccount(id: string): boolean {
    const account = this.accounts.find(a => a.id === id);
    if (!account) return false;

    this.activeAccountId = id;
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, id);
    return true;
  }

  // Get the currently active account
  getActiveAccount(): Account | null {
    if (!this.activeAccountId) return null;
    return this.accounts.find(a => a.id === this.activeAccountId) || null;
  }

  // Get the active account ID
  getActiveAccountId(): string | null {
    return this.activeAccountId;
  }

  // Check if there's an active account
  hasActiveAccount(): boolean {
    return this.activeAccountId !== null && this.getActiveAccount() !== null;
  }

  // Get storage key for a base key (adds account suffix)
  getStorageKey(baseKey: string): string {
    if (!this.activeAccountId) {
      throw new Error('No active account selected');
    }
    return `${baseKey}_${this.activeAccountId}`;
  }

  // Clear active account (for switching)
  clearActiveAccount(): void {
    this.activeAccountId = null;
    localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  }

  // Check if any accounts exist
  hasAccounts(): boolean {
    return this.accounts.length > 0;
  }

  // Get account count
  getAccountCount(): number {
    return this.accounts.length;
  }

  // Save accounts to localStorage
  private save(): boolean {
    try {
      const saveData = {
        accounts: this.accounts,
        nextId: this.nextId,
      };
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(saveData));
      return true;
    } catch (error) {
      console.error('Failed to save accounts:', error);
      return false;
    }
  }

  // Load accounts from localStorage
  private load(): boolean {
    try {
      const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (saved) {
        const saveData = JSON.parse(saved);
        this.accounts = saveData.accounts || [];
        this.nextId = saveData.nextId || this.accounts.length + 1;
      }

      // Load active account ID (but don't validate until needed)
      const activeId = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      if (activeId && this.accounts.find(a => a.id === activeId)) {
        this.activeAccountId = activeId;
      }

      return true;
    } catch (error) {
      console.error('Failed to load accounts:', error);
      return false;
    }
  }
}

// Singleton instance
export const AccountManager = new AccountManagerClass();

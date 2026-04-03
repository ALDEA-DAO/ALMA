// Username service — manages unique lowercase usernames

import { randomUUID } from "node:crypto";
import type { createQueries, UserRecord } from "../db/schema.js";

const USERNAME_REGEX = /^[a-z][a-z0-9\-]{2,29}$/;

export class UsernameService {
  constructor(private queries: ReturnType<typeof createQueries>) {}

  validate(username: string): { valid: boolean; error?: string } {
    const normalized = username.toLowerCase().trim();

    if (normalized !== username) {
      return { valid: false, error: "Username must be lowercase with no leading/trailing spaces" };
    }

    if (!USERNAME_REGEX.test(normalized)) {
      return {
        valid: false,
        error: "Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens",
      };
    }

    return { valid: true };
  }

  isAvailable(username: string): boolean {
    return !this.queries.isUsernameTaken.get(username);
  }

  register(username: string, walletHash: string, email?: string, authProvider = "wallet"): UserRecord {
    const validation = this.validate(username);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (!this.isAvailable(username)) {
      throw new Error(`Username "${username}" is already taken`);
    }

    const id = randomUUID();
    this.queries.insertUser.run(id, username, email ?? null, walletHash, authProvider);
    return this.queries.getUserByUsername.get(username) as UserRecord;
  }

  getByUsername(username: string): UserRecord | undefined {
    return this.queries.getUserByUsername.get(username) as UserRecord | undefined;
  }

  getByWalletHash(walletHash: string): UserRecord | undefined {
    return this.queries.getUserByWalletHash.get(walletHash) as UserRecord | undefined;
  }
}

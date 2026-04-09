// Username service — manages unique lowercase usernames

import { randomUUID } from "node:crypto";
import type { Queries, UserRecord } from "../db/schema.js";

const USERNAME_REGEX = /^[a-z][a-z0-9\-]{2,29}$/;

export class UsernameService {
  constructor(private queries: Queries) {}

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

  async isAvailable(username: string): Promise<boolean> {
    return !(await this.queries.isUsernameTaken(username));
  }

  async register(username: string, walletHash: string, email?: string, authProvider = "wallet"): Promise<UserRecord> {
    const validation = this.validate(username);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (!(await this.isAvailable(username))) {
      throw new Error(`Username "${username}" is already taken`);
    }

    const id = randomUUID();
    await this.queries.insertUser(id, username, email ?? null, walletHash, authProvider);
    return (await this.queries.getUserByUsername(username))!;
  }

  async getByUsername(username: string): Promise<UserRecord | undefined> {
    return this.queries.getUserByUsername(username);
  }

  async getByWalletHash(walletHash: string): Promise<UserRecord | undefined> {
    return this.queries.getUserByWalletHash(walletHash);
  }
}

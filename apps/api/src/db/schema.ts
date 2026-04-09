// Neon Postgres database schema and queries for payment tracking and reconciliation

import { Pool, neonConfig } from "@neondatabase/serverless";

export type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "MINT_INITIATED"
  | "COMPLETE"
  | "FAILED"
  | "REFUNDED";

export type PaymentMethod = "stripe" | "mercadopago" | "ada" | "aldea_token";

export interface PaymentRecord {
  id: string;
  method: PaymentMethod;
  external_id: string;
  wallet_hash: string;
  username: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  credential_id: string | null;
  idempotency_key: string;
  error: string | null;
  retries: number;
  receipt_tx_hash: string | null;
  receipt_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string | null;
  wallet_hash: string;
  auth_provider: string;
  created_at: string;
}

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

export async function initDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      wallet_hash TEXT NOT NULL,
      auth_provider TEXT NOT NULL DEFAULT 'wallet',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_wallet_hash ON users(wallet_hash);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      external_id TEXT NOT NULL,
      wallet_hash TEXT NOT NULL,
      username TEXT,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      credential_id TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      error TEXT,
      retries INTEGER NOT NULL DEFAULT 0,
      receipt_tx_hash TEXT,
      receipt_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_wallet_hash ON payments(wallet_hash);
    CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id);

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payments(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ─── Query functions factory ─────────────────────────────────────────────────

export function createQueries(pool: Pool) {
  return {
    // ─── Payments ──────────────────────────────────────────────────────

    async insertPayment(
      id: string, method: string, externalId: string, walletHash: string,
      username: string | null, amount: string, currency: string, idempotencyKey: string,
    ) {
      await pool.query(
        `INSERT INTO payments (id, method, external_id, wallet_hash, username, amount, currency, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)`,
        [id, method, externalId, walletHash, username, amount, currency, idempotencyKey],
      );
    },

    async updatePaymentStatus(status: string, id: string) {
      await pool.query(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id],
      );
    },

    async setCredentialId(credentialId: string, id: string) {
      await pool.query(
        `UPDATE payments SET credential_id = $1, status = 'COMPLETE', updated_at = NOW() WHERE id = $2`,
        [credentialId, id],
      );
    },

    async setError(error: string, id: string) {
      await pool.query(
        `UPDATE payments SET error = $1, retries = retries + 1, updated_at = NOW() WHERE id = $2`,
        [error, id],
      );
    },

    async markFailed(error: string, id: string) {
      await pool.query(
        `UPDATE payments SET status = 'FAILED', error = $1, updated_at = NOW() WHERE id = $2`,
        [error, id],
      );
    },

    async getPaymentById(id: string): Promise<PaymentRecord | undefined> {
      const { rows } = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
      return rows[0] as PaymentRecord | undefined;
    },

    async getPaymentByExternalId(externalId: string, method: string): Promise<PaymentRecord | undefined> {
      const { rows } = await pool.query(
        `SELECT * FROM payments WHERE external_id = $1 AND method = $2`,
        [externalId, method],
      );
      return rows[0] as PaymentRecord | undefined;
    },

    async getPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | undefined> {
      const { rows } = await pool.query(
        `SELECT * FROM payments WHERE idempotency_key = $1`,
        [key],
      );
      return rows[0] as PaymentRecord | undefined;
    },

    async getPendingReconciliation(): Promise<PaymentRecord[]> {
      const { rows } = await pool.query(
        `SELECT * FROM payments
         WHERE status IN ('CONFIRMED', 'MINT_INITIATED')
         AND updated_at < NOW() - INTERVAL '5 minutes'
         ORDER BY created_at ASC
         LIMIT 50`,
      );
      return rows as PaymentRecord[];
    },

    async getPaymentsByWallet(walletHash: string): Promise<PaymentRecord[]> {
      const { rows } = await pool.query(
        `SELECT * FROM payments WHERE wallet_hash = $1 ORDER BY created_at DESC`,
        [walletHash],
      );
      return rows as PaymentRecord[];
    },

    // ─── Receipts ─────────────────────────────────────────────────────

    async setReceiptTxHash(txHash: string, id: string) {
      await pool.query(
        `UPDATE payments SET receipt_tx_hash = $1, receipt_status = 'SUBMITTED', updated_at = NOW() WHERE id = $2`,
        [txHash, id],
      );
    },

    async setReceiptStatus(status: string, id: string) {
      await pool.query(
        `UPDATE payments SET receipt_status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id],
      );
    },

    async getPendingReceipts(): Promise<PaymentRecord[]> {
      const { rows } = await pool.query(
        `SELECT * FROM payments
         WHERE method IN ('stripe', 'mercadopago')
         AND status = 'COMPLETE'
         AND (receipt_status IS NULL OR receipt_status = 'PENDING')
         AND updated_at < NOW() - INTERVAL '1 minutes'
         ORDER BY created_at ASC
         LIMIT 20`,
      );
      return rows as PaymentRecord[];
    },

    async getFailedReceipts(): Promise<PaymentRecord[]> {
      const { rows } = await pool.query(
        `SELECT * FROM payments
         WHERE method IN ('stripe', 'mercadopago')
         AND status = 'COMPLETE'
         AND receipt_status = 'FAILED'
         AND updated_at < NOW() - INTERVAL '10 minutes'
         ORDER BY created_at ASC
         LIMIT 10`,
      );
      return rows as PaymentRecord[];
    },

    // ─── Audit log ────────────────────────────────────────────────────

    async insertAuditLog(paymentId: string, fromStatus: string | null, toStatus: string, detail: string | null) {
      await pool.query(
        `INSERT INTO audit_log (payment_id, from_status, to_status, detail) VALUES ($1, $2, $3, $4)`,
        [paymentId, fromStatus, toStatus, detail],
      );
    },

    // ─── Users ────────────────────────────────────────────────────────

    async insertUser(id: string, username: string, email: string | null, walletHash: string, authProvider: string) {
      await pool.query(
        `INSERT INTO users (id, username, email, wallet_hash, auth_provider) VALUES ($1, $2, $3, $4, $5)`,
        [id, username, email, walletHash, authProvider],
      );
    },

    async getUserByUsername(username: string): Promise<UserRecord | undefined> {
      const { rows } = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
      return rows[0] as UserRecord | undefined;
    },

    async getUserByWalletHash(walletHash: string): Promise<UserRecord | undefined> {
      const { rows } = await pool.query(`SELECT * FROM users WHERE wallet_hash = $1`, [walletHash]);
      return rows[0] as UserRecord | undefined;
    },

    async isUsernameTaken(username: string): Promise<boolean> {
      const { rows } = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [username]);
      return rows.length > 0;
    },
  };
}

export type Queries = ReturnType<typeof createQueries>;

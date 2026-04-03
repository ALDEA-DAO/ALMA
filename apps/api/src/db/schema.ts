// SQLite database schema and queries for payment tracking and reconciliation

import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

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

export function initDatabase(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      wallet_hash TEXT NOT NULL,
      auth_provider TEXT NOT NULL DEFAULT 'wallet',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_wallet_hash ON payments(wallet_hash);
    CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    );
  `);

  return db;
}

// ─── Prepared statements factory ──────────────────────────────────────────

export function createQueries(db: Database.Database) {
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, method, external_id, wallet_hash, username, amount, currency, status, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `);

  const updatePaymentStatus = db.prepare(`
    UPDATE payments SET status = ?, updated_at = datetime('now') WHERE id = ?
  `);

  const setCredentialId = db.prepare(`
    UPDATE payments SET credential_id = ?, status = 'COMPLETE', updated_at = datetime('now') WHERE id = ?
  `);

  const setError = db.prepare(`
    UPDATE payments SET error = ?, retries = retries + 1, updated_at = datetime('now') WHERE id = ?
  `);

  const markFailed = db.prepare(`
    UPDATE payments SET status = 'FAILED', error = ?, updated_at = datetime('now') WHERE id = ?
  `);

  const getPaymentById = db.prepare(`
    SELECT * FROM payments WHERE id = ?
  `);

  const getPaymentByExternalId = db.prepare(`
    SELECT * FROM payments WHERE external_id = ? AND method = ?
  `);

  const getPaymentByIdempotencyKey = db.prepare(`
    SELECT * FROM payments WHERE idempotency_key = ?
  `);

  const getPendingReconciliation = db.prepare(`
    SELECT * FROM payments
    WHERE status IN ('CONFIRMED', 'MINT_INITIATED')
    AND updated_at < datetime('now', '-5 minutes')
    ORDER BY created_at ASC
    LIMIT 50
  `);

  const getPaymentsByWallet = db.prepare(`
    SELECT * FROM payments WHERE wallet_hash = ? ORDER BY created_at DESC
  `);

  const insertAuditLog = db.prepare(`
    INSERT INTO audit_log (payment_id, from_status, to_status, detail)
    VALUES (?, ?, ?, ?)
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, wallet_hash, auth_provider)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getUserByUsername = db.prepare(`
    SELECT * FROM users WHERE username = ?
  `);

  const getUserByWalletHash = db.prepare(`
    SELECT * FROM users WHERE wallet_hash = ?
  `);

  const isUsernameTaken = db.prepare(`
    SELECT 1 FROM users WHERE username = ?
  `);

  return {
    insertPayment,
    updatePaymentStatus,
    setCredentialId,
    setError,
    markFailed,
    getPaymentById,
    getPaymentByExternalId,
    getPaymentByIdempotencyKey,
    getPendingReconciliation,
    getPaymentsByWallet,
    insertAuditLog,
    insertUser,
    getUserByUsername,
    getUserByWalletHash,
    isUsernameTaken,
  };
}

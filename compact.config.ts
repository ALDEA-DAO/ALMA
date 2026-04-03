// Soulbound Protocol — Compact compiler configuration (Midnight)
//
// Usage:
//   Compile a contract:     compact compile contracts/midnight/ALMACredentialContract.compact contracts/midnight/out/
//   Skip ZK keys (fast):    compact compile --skip-zk contracts/midnight/ALMACredentialContract.compact contracts/midnight/out/
//
// The compiler generates in the output directory:
//   - TypeScript contract API
//   - ZK circuits (zkir)
//   - Proving/verifying keys (takes time)

export const compactConfig = {
  // Root directory for Midnight contracts
  contractsDir: "contracts/midnight",

  // Compiler output directory
  outputDir: "contracts/midnight/out",

  // Contracts to compile (in dependency order)
  contracts: [
    "SoulboundCredentialContract.compact",
  ],

  // Compiler options
  compilerOptions: {
    // In development, use --skip-zk to compile fast without generating proving keys
    // In CI/staging, generate full keys
    skipZk: process.env.NODE_ENV === "development",
  },
} as const;

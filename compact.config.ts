// Soulbound Protocol — Compact compiler configuration (Midnight)
//
// Uso:
//   Compilar un contrato:   compact compile contracts/midnight/ALMACredentialContract.compact contracts/midnight/out/
//   Skip ZK keys (rápido):  compact compile --skip-zk contracts/midnight/ALMACredentialContract.compact contracts/midnight/out/
//
// El compilador genera en el directorio de output:
//   - TypeScript API del contrato
//   - ZK circuits (zkir)
//   - Proving/verifying keys (requiere tiempo)

export const compactConfig = {
  // Directorio raíz de contratos Midnight
  contractsDir: "contracts/midnight",

  // Directorio de output del compilador
  outputDir: "contracts/midnight/out",

  // Contratos a compilar (en orden de dependencia)
  contracts: [
    "SoulboundCredentialContract.compact",
  ],

  // Opciones del compilador
  compilerOptions: {
    // En desarrollo, usar --skip-zk para compilar rápido sin generar proving keys
    // En CI/staging, generar keys completas
    skipZk: process.env.NODE_ENV === "development",
  },
} as const;

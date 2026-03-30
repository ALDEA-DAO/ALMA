"use client";

export type TxStage =
  | "idle"
  | "signing"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "issuing"
  | "complete"
  | "error";

interface TransactionStatusProps {
  stage: TxStage;
  txHash?: string;
  error?: string;
}

const STAGE_LABELS: Record<TxStage, string> = {
  idle: "",
  signing: "Waiting for wallet signature...",
  submitting: "Submitting transaction...",
  confirming: "Waiting for on-chain confirmation...",
  confirmed: "Payment confirmed!",
  issuing: "Issuing your ALMA credential...",
  complete: "Your ALMA is ready!",
  error: "Something went wrong",
};

export function TransactionStatus({
  stage,
  txHash,
  error,
}: TransactionStatusProps) {
  if (stage === "idle") return null;

  const isLoading = ["signing", "submitting", "confirming", "issuing"].includes(
    stage
  );
  const isSuccess = stage === "complete";
  const isError = stage === "error";

  return (
    <div
      className={`alma-card mt-6 ${
        isSuccess
          ? "border-[var(--alma-success)]/30"
          : isError
            ? "border-[var(--alma-error)]/30"
            : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {isLoading && <span className="alma-spinner" />}
        {isSuccess && (
          <span className="text-[var(--alma-success)] text-lg">&#10003;</span>
        )}
        {isError && (
          <span className="text-[var(--alma-error)] text-lg">&#10007;</span>
        )}
        <div>
          <p
            className={`font-medium ${
              isSuccess
                ? "text-[var(--alma-success)]"
                : isError
                  ? "text-[var(--alma-error)]"
                  : ""
            }`}
          >
            {STAGE_LABELS[stage]}
          </p>
          {txHash && (
            <p className="text-xs text-[var(--alma-text-dim)] font-mono mt-1 break-all">
              Tx: {txHash}
            </p>
          )}
          {error && (
            <p className="text-xs text-[var(--alma-error)] mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// @stellarcred/sdk — typed error taxonomy
//
// Structured errors that surface contract panics, RPC failures, and indexer
// issues as typed, actionable errors (#404). Every error code maps to the
// same human message everywhere (SDK, frontend, docs), with the contract's
// ProofRegistry error enum as the single source of truth.

/**
 * Maps ProofRegistry on-chain error codes to human-readable messages.
 * Kept in sync with the Rust contract's `Error` enum and the frontend's
 * `PROOF_REGISTRY_ERRORS` table (frontend/lib/contract-errors.ts).
 *
 * Contract error codes:
 *   NotInitialized          = 1
 *   VerificationFailed      = 2
 *   NotAuthorized           = 3
 *   IssuerNotTrusted        = 4
 *   IssuerKeyMismatch       = 5
 *   ProofNotFound           = 6
 *   BatchTooLarge           = 7
 *   BatchEmpty              = 8
 *   DuplicateCredentialType = 9
 *   AggregateLayoutInvalid  = 10
 *   SubmissionsPaused       = 11
 *   InvalidExpiry           = 12
 */
export const PROOF_REGISTRY_ERROR_MESSAGES: Record<number, string> = {
  1: "Contracts not initialised — check that all contract IDs are set in the environment.",
  2: "Proof verification failed — the ZK proof is invalid or was generated against the wrong circuit VK.",
  3: "Not authorised — wallet signature missing or wrong account.",
  4: "Issuer not trusted — the issuer address isn't registered for this credential type.",
  5: "Issuer key mismatch — this credential was signed with a key that doesn't match what's registered on-chain. Re-issue the credential and try again.",
  6: "Proof not found — no on-chain proof exists for this holder and credential type.",
  7: "Batch too large — reduce the number of proofs and try again.",
  8: "Batch is empty — include at least one proof submission.",
  9: "Duplicate credential type — the batch contains two proofs for the same claim type. Remove the duplicate and try again.",
  10: "Aggregate proof layout invalid — the number of credentials or public inputs don't match the expected format. Re-generate the aggregate proof.",
  11: "Submissions paused — the protocol admin has temporarily halted new proof submissions. Try again later.",
  12: "Invalid expiry — the credential expiry is either in the past or too far in the future. Re-issue with a valid validity window.",
};

/**
 * Contract error codes from the ProofRegistry contract's `Error` enum.
 * Exported as a const object so callers can switch on codes without hardcoding
 * magic numbers.
 */
export const ContractErrorCode = {
  NotInitialized: 1,
  VerificationFailed: 2,
  NotAuthorized: 3,
  IssuerNotTrusted: 4,
  IssuerKeyMismatch: 5,
  ProofNotFound: 6,
  BatchTooLarge: 7,
  BatchEmpty: 8,
  DuplicateCredentialType: 9,
  AggregateLayoutInvalid: 10,
  SubmissionsPaused: 11,
  InvalidExpiry: 12,
} as const;

export type ContractErrorCodeType = (typeof ContractErrorCode)[keyof typeof ContractErrorCode];

/**
 * Typed error surfaced when a ProofRegistry transaction fails with a contract
 * panic. Carries the numeric error code and a human message so callers can
 * branch programmatically (e.g. retry for transient errors, show terminal UI
 * for permanent failures) without parsing strings.
 *
 * @example
 * ```ts
 * try {
 *   await submitProof(...);
 * } catch (err) {
 *   if (err instanceof ContractError) {
 *     if (err.code === ContractErrorCode.IssuerNotTrusted) {
 *       // Show "issuer not registered" UI
 *     } else if (err.code === ContractErrorCode.VerificationFailed) {
 *       // Show "proof invalid" UI
 *     }
 *   }
 * }
 * ```
 */
export class ContractError extends Error {
  /**
   * Numeric error code from the contract's `Error` enum. Compare against
   * {@link ContractErrorCode} constants rather than hardcoding numbers.
   */
  code: number;

  /**
   * Human-readable error message from {@link PROOF_REGISTRY_ERROR_MESSAGES}.
   * Safe to display directly to users.
   */
  friendlyMessage: string;

  /**
   * Raw error string from the RPC/contract layer, e.g. `"Error(Contract, #4)"`.
   * Useful for debugging but not user-facing.
   */
  raw: string;

  constructor(code: number, friendlyMessage: string, raw: string) {
    super(friendlyMessage);
    this.name = "ContractError";
    this.code = code;
    this.friendlyMessage = friendlyMessage;
    this.raw = raw;
  }

  /**
   * Returns true if this error represents a transient/retryable failure
   * (e.g. submissions paused, RPC timeout) vs. a terminal failure that
   * requires user action (e.g. invalid proof, issuer not trusted).
   */
  isRetryable(): boolean {
    return this.code === ContractErrorCode.SubmissionsPaused;
  }

  /**
   * Returns true if this error indicates the holder needs to take action
   * before retrying (e.g. re-issue credential, register issuer).
   */
  isTerminal(): boolean {
    return [
      ContractErrorCode.VerificationFailed,
      ContractErrorCode.IssuerNotTrusted,
      ContractErrorCode.IssuerKeyMismatch,
      ContractErrorCode.InvalidExpiry,
      ContractErrorCode.NotInitialized,
    ].includes(this.code);
  }
}

/**
 * Parse a raw contract error string into a {@link ContractError}.
 * Handles multiple error formats from the RPC layer:
 * - `Error(Contract, #N)` → contract error code N
 * - `ContractError(N)` or `ContractError(Some(N))` → contract error code N
 * - Unrecognized → returns null (caller should handle as generic error)
 *
 * @example
 * ```ts
 * const err = parseContractError("Error(Contract, #4)");
 * if (err) {
 *   console.log(err.code); // 4
 *   console.log(err.friendlyMessage); // "Issuer not trusted..."
 * }
 * ```
 */
export function parseContractError(raw: string): ContractError | null {
  if (!raw) return null;

  // Match `Error(Contract, #N)` format
  let match = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = parseInt(match[1], 10);
    const message = PROOF_REGISTRY_ERROR_MESSAGES[code] ?? `Contract error #${code}.`;
    return new ContractError(code, message, raw);
  }

  // Match `ContractError(N)` or `ContractError(Some(N))` format (simulation errors)
  match = raw.match(/ContractError\((?:Some\()?(\d+)/);
  if (match) {
    const code = parseInt(match[1], 10);
    const message = PROOF_REGISTRY_ERROR_MESSAGES[code] ?? `Contract error #${code}.`;
    return new ContractError(code, message, raw);
  }

  return null;
}

/**
 * Error thrown when an RPC request to the Soroban network fails.
 * Distinguishes between network failures (timeout, unreachable), server errors
 * (500), and transaction failures (contract panic).
 */
export class RpcError extends Error {
  cause?: unknown;
  /** HTTP status code when the RPC responded with an error status. */
  status?: number;
  /** Parsed contract error if the RPC failure was due to a contract panic. */
  contractError?: ContractError;

  constructor(
    message = "Soroban RPC request failed",
    options?: { cause?: unknown; status?: number; contractError?: ContractError },
  ) {
    super(message);
    this.name = "RpcError";
    this.cause = options?.cause;
    this.status = options?.status;
    this.contractError = options?.contractError;
  }

  /**
   * Returns true if this RPC error wraps a contract panic (as opposed to
   * a network/timeout issue).
   */
  isContractError(): boolean {
    return this.contractError !== undefined;
  }
}

/**
 * Error thrown when an indexer request fails or returns malformed data.
 * Already exists in indexer.ts; re-exported here for completeness.
 */
export { IndexerError } from "./indexer";

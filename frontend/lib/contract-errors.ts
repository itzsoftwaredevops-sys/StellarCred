"use client";

// Error taxonomy, fee estimation helpers, and simulation mapping for the
// StellarCred ProofRegistry contract.
//
// This is the single source of truth for contract error codes — shared with
// both the client-side interaction layer (contracts.ts) and the SDK's typed
// error helpers (packages/sdk/src/errors.ts). Keep error messages here and
// import from this module everywhere else.

// Re-export from SDK to ensure single source of truth (#404)
export { PROOF_REGISTRY_ERROR_MESSAGES as PROOF_REGISTRY_ERRORS } from "@stellarcred/sdk/src/errors";

// Legacy alias for backward compatibility
import { PROOF_REGISTRY_ERROR_MESSAGES } from "@stellarcred/sdk/src/errors";
export const _PROOF_REGISTRY_ERRORS_LEGACY = PROOF_REGISTRY_ERROR_MESSAGES;

// ── ContractError ─────────────────────────────────────────────────────────────

/** Structured representation of a contract-layer error surfaced to the UI. */
export interface ContractError {
  friendly: string;
  code: number | null;
  raw: string;
}

/**
 * Normalises a raw contract error string into a {@link ContractError}.
 * 
 * This is a frontend-specific wrapper that maintains backward compatibility
 * with existing UI code. For new code, prefer importing ContractError from
 * the SDK (@stellarcred/sdk) which provides typed error codes and helper
 * methods like isRetryable() and isTerminal().
 *
 * Handles:
 * - Numeric contract errors:  `Error(Contract, #N)` → looks up {@link PROOF_REGISTRY_ERRORS}
 * - Wallet auth failures:     `Error(Auth…)`        → friendly auth message
 * - Wasm VM errors:           `Error(WasmVm…)`      → friendly malformed-input message
 * - Anything else:            returned verbatim with `code: null`
 */
export function parseContractError(raw: string): ContractError {
  const match = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = parseInt(match[1]);
    return {
      code,
      friendly: PROOF_REGISTRY_ERRORS[code] ?? `Contract error #${code}.`,
      raw,
    };
  }
  if (raw.includes("Error(Auth")) {
    return {
      code: null,
      friendly: "Wallet authorisation failed — approve the transaction in your wallet.",
      raw,
    };
  }
  if (raw.includes("Error(WasmVm")) {
    return {
      code: null,
      friendly: "Contract execution failed — the proof or inputs were malformed.",
      raw,
    };
  }
  return { code: null, friendly: raw, raw };
}

// ── Preflight / fee-estimation helpers (Issue #409) ───────────────────────────

/** Stellar uses 10^7 stroops per 1 lumen (XLM). */
export const STROOPS_PER_XLM = 1e7;

/**
 * Format a fee in stroops as a compact human string, e.g. `12345` →
 * `"0.0012345 XLM"`. `0`/negative values render as `"0 XLM"`.
 */
export function formatFeeXlm(stroops: number): string {
  if (!Number.isFinite(stroops) || stroops <= 0) return "0 XLM";
  const xlm = stroops / STROOPS_PER_XLM;
  const cleaned = xlm
    .toFixed(7)
    .replace(/\.?0+$/, ""); // strip trailing zeros (and the dot) for display
  return `${cleaned || "0"} XLM`;
}

export interface FeeEstimate {
  /** Estimated fee in stroops, from the simulation's minimum resource fee. */
  stroops: number;
  /** Human display string, e.g. "0.0012345 XLM". */
  display: string;
}

export type PreflightResult =
  | { ok: true; fee: FeeEstimate }
  | { ok: false; error: ContractError };

/**
 * Normalize the raw Soroban error string so {@link parseContractError} can map
 * it to the ProofRegistry error table. Contract errors sometimes arrive as
 * `Result(ContractError(N))` / `ContractError(Some(N))` rather than the
 * `Error(Contract, #N)` form the map keys on; fold those into the canonical
 * form while leaving already-canonical strings untouched.
 */
export function normalizeSimulationError(raw: string): string {
  if (!raw) return raw;
  if (raw.includes("Error(Contract,")) return raw;
  const m = raw.match(/ContractError\((?:Some\()?(\d+)/);
  if (m) return `Error(Contract, #${m[1]})`;
  return raw;
}

/**
 * Pure mapping from a Soroban simulation outcome to a {@link PreflightResult}.
 * Keeping this split from the network call lets the fee extraction and error
 * mapping be exercised in unit tests with plain-object fixtures.
 */
export function evaluateSimulation(outcome: {
  success: boolean;
  minResourceFee?: number;
  error?: string;
}): PreflightResult {
  if (!outcome.success) {
    return {
      ok: false,
      error: parseContractError(normalizeSimulationError(outcome.error ?? "")),
    };
  }
  const stroops =
    Number.isFinite(outcome.minResourceFee) && (outcome.minResourceFee as number) > 0
      ? Math.floor(outcome.minResourceFee as number)
      : 0;
  return { ok: true, fee: { stroops, display: formatFeeXlm(stroops) } };
}

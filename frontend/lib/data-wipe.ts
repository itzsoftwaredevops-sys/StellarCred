"use client";

/**
 * Full local data wipe for StellarCred (#558).
 * 
 * Removes all credentials, proof cache, timeline, onboarding state, wallet
 * selection, and preferences from this browser. The holder who invokes this
 * loses access to their credentials unless they've backed them up — the
 * function prompts for export before wiping.
 * 
 * This is the single action to completely leave StellarCred without orphaning
 * storage keys. It's more surgical than clearing all site data (which would
 * also remove unrelated browser state) and less error-prone than removing
 * credentials individually (which leaves timeline/cache/key behind).
 */

import { getAllStorageKeys, STORAGE_KEYS } from "./storage-keys";
import { exportCredentials, lockCredentialStore } from "./credential";
import { isStorageAvailable } from "./safe-storage";

export interface WipeOptions {
  /**
   * If true, skip the backup export prompt and wipe immediately.
   * Use with caution — credentials are unrecoverable without a backup.
   */
  skipBackupPrompt?: boolean;
}

export interface WipeResult {
  /** True if the wipe completed successfully */
  success: boolean;
  /** Number of keys removed from localStorage */
  keysRemoved: number;
  /** Error message if the wipe failed */
  error?: string;
  /** Exported credential JSON if the user accepted the backup prompt */
  backup?: string;
}

/**
 * Prompt the user to export their credentials before wiping.
 * Returns the exported JSON if accepted, or null if declined/unavailable.
 */
async function promptForBackup(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  
  try {
    const credentialsJson = await exportCredentials();
    
    // No credentials to backup
    if (!credentialsJson || credentialsJson === "[]") {
      return null;
    }

    // Create a downloadable blob
    const blob = new Blob([credentialsJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `stellarcred-backup-${timestamp}.json`;

    // Trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return credentialsJson;
  } catch (err) {
    console.error("Backup export failed:", err);
    return null;
  }
}

/**
 * Wipe all StellarCred data from localStorage.
 * 
 * @param options - Configuration options
 * @returns Result indicating success, keys removed, and optional backup
 * 
 * @example
 * ```ts
 * const result = await wipeAllData();
 * if (result.success) {
 *   console.log(`Removed ${result.keysRemoved} keys`);
 *   if (result.backup) {
 *     console.log("Backup saved");
 *   }
 * }
 * ```
 */
export async function wipeAllData(options: WipeOptions = {}): Promise<WipeResult> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      keysRemoved: 0,
      error: "localStorage is not available (private mode or blocked)",
    };
  }

  let backup: string | undefined;

  // Prompt for backup unless explicitly skipped
  if (!options.skipBackupPrompt) {
    try {
      const exported = await promptForBackup();
      if (exported) {
        backup = exported;
      }
    } catch (err) {
      // Backup failed — continue with wipe anyway (user may have nothing to back up)
      console.warn("Backup prompt failed, continuing with wipe:", err);
    }
  }

  try {
    // Get all keys before starting removal
    const keysToRemove = getAllStorageKeys();
    let removed = 0;

    // Remove each key individually to handle failures gracefully
    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
        removed++;
      } catch (err) {
        console.error(`Failed to remove key: ${key}`, err);
        // Continue removing other keys even if one fails
      }
    }

    // Lock the credential store (clear in-memory encryption key)
    lockCredentialStore();

    return {
      success: true,
      keysRemoved: removed,
      backup,
    };
  } catch (err) {
    return {
      success: false,
      keysRemoved: 0,
      error: err instanceof Error ? err.message : "Unknown error during wipe",
    };
  }
}

/**
 * Get a human-readable summary of what will be wiped.
 * Useful for showing in confirmation dialogs.
 */
export function getWipeSummary(): {
  credentials: boolean;
  proofCache: boolean;
  timelines: number;
  onboarding: boolean;
  wallet: boolean;
  theme: boolean;
} {
  if (!isStorageAvailable()) {
    return {
      credentials: false,
      proofCache: false,
      timelines: 0,
      onboarding: false,
      wallet: false,
      theme: false,
    };
  }

  try {
    const keys = getAllStorageKeys();
    return {
      credentials: keys.includes(STORAGE_KEYS.CREDENTIALS),
      proofCache: keys.includes(STORAGE_KEYS.PROOF_CACHE),
      timelines: keys.filter((k) => k.startsWith(STORAGE_KEYS.PROOF_TIMELINE_PREFIX)).length,
      onboarding: keys.includes(STORAGE_KEYS.ONBOARDING) || keys.includes(STORAGE_KEYS.ONBOARDING_LEGACY),
      wallet: keys.includes(STORAGE_KEYS.WALLET_ID),
      theme: keys.includes(STORAGE_KEYS.THEME),
    };
  } catch {
    return {
      credentials: false,
      proofCache: false,
      timelines: 0,
      onboarding: false,
      wallet: false,
      theme: false,
    };
  }
}

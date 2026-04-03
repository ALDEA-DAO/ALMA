"use client";

import type { UseAuthResult } from "../hooks/useAuth.js";

export interface UserProfileProps {
  auth: UseAuthResult;
}

/**
 * UserProfile — Displays the authenticated user's identity.
 *
 * Shows username@aldea.world, auth method badge, and logout button.
 * Intentionally hides wallet addresses and blockchain details.
 */
export function UserProfile({ auth }: UserProfileProps) {
  if (!auth.user) return null;

  const { user } = auth;

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
        {user.username[0]?.toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {user.displayName}
        </p>
        <p className="text-xs text-gray-400">
          {user.walletType === "abstract" ? "Social login" : "Wallet connected"}
        </p>
      </div>

      {/* Logout */}
      <button
        onClick={() => auth.logout()}
        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
      >
        Sign out
      </button>
    </div>
  );
}

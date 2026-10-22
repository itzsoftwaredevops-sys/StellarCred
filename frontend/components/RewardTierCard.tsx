/**
 * components/RewardTierCard.tsx
 * 
 * Display a campaign reward tier with early-bird countdown, inventory status,
 * and discount badge.
 */
import { useState, useEffect } from "react";
import { formatCountdown } from "@/utils/format";
import type { CampaignRewardTier } from "@/utils/types";

interface RewardTierCardProps {
  tier: CampaignRewardTier;
  onSelect?: (tier: CampaignRewardTier) => void;
  className?: string;
}

export default function RewardTierCard({
  tier,
  onSelect,
  className = "",
}: RewardTierCardProps) {
  const [now, setNow] = useState(() => Date.now());

  // Update countdown every second
  useEffect(() => {
    if (!tier.earlyBirdDeadline || tier.isExpired) return;
    
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [tier.earlyBirdDeadline, tier.isExpired]);

  const isDiscounted = tier.originalAmountXLM && parseFloat(tier.originalAmountXLM) > parseFloat(tier.amountXLM);
  const isEarlyBird = tier.badgeLabel.toLowerCase().includes("early");
  const hasInventory = tier.inventoryCap !== undefined && tier.inventoryCap !== null;
  const isSoldOut = hasInventory && tier.inventoryClaimed >= tier.inventoryCap;

  // Determine card styling based on availability
  const cardClasses = [
    "border-2 rounded-lg p-6 transition-all duration-200",
    tier.isAvailable
      ? "border-green-500 hover:shadow-lg hover:scale-[1.02] bg-white dark:bg-gray-800"
      : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 opacity-75",
    className,
  ].join(" ");

  const badgeClasses = [
    "inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold mb-3",
    isEarlyBird && tier.isAvailable
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  ].join(" ");

  return (
    <div className={cardClasses}>
      {/* Badge Label */}
      <div className={badgeClasses}>
        {isEarlyBird && tier.isAvailable && <span className="mr-1">🐦</span>}
        {tier.badgeLabel}
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {tier.title}
      </h3>

      {/* Amount with optional strike-through for discounts */}
      <div className="mb-3">
        {isDiscounted && (
          <span className="text-sm text-gray-500 dark:text-gray-400 line-through mr-2">
            {tier.originalAmountXLM} XLM
          </span>
        )}
        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
          {tier.amountXLM} XLM
        </span>
      </div>

      {/* Description */}
      {tier.description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {tier.description}
        </p>
      )}

      {/* Countdown Timer (only for early-bird with deadline) */}
      {tier.earlyBirdDeadline && !tier.isExpired && (
        <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
              ⏰ Early-bird ends in:
            </span>
            <span className="text-sm font-bold text-yellow-900 dark:text-yellow-100 font-mono">
              {formatCountdown(tier.earlyBirdDeadline, now)}
            </span>
          </div>
        </div>
      )}

      {/* Inventory Status */}
      {hasInventory && (
        <div className="mb-4">
          {tier.slotsRemaining !== undefined && tier.slotsRemaining !== null ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">
                {tier.slotsRemaining} of {tier.inventoryCap}
              </span>{" "}
              slots remaining
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Limited to {tier.inventoryCap} slots
            </p>
          )}
          {/* Progress bar for inventory */}
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isSoldOut
                  ? "bg-red-500"
                  : tier.slotsRemaining !== undefined && tier.slotsRemaining < 10
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${
                  tier.inventoryCap
                    ? (tier.inventoryClaimed / tier.inventoryCap) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {!hasInventory && tier.isAvailable && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Unlimited availability
        </p>
      )}

      {/* Call to Action Button */}
      <button
        onClick={() => onSelect && onSelect(tier)}
        disabled={!tier.isAvailable}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          tier.isAvailable
            ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
            : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        }`}
      >
        {tier.isExpired
          ? "⏱️ Expired"
          : isSoldOut
          ? "🚫 Sold Out"
          : tier.isAvailable
          ? "Select This Tier"
          : "Unavailable"}
      </button>
    </div>
  );
}

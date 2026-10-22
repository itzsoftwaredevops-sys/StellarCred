/**
 * components/__tests__/RewardTierCard.test.tsx
 * 
 * Test suite for the RewardTierCard component.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RewardTierCard from "../RewardTierCard";
import type { CampaignRewardTier } from "@/utils/types";

// Mock the formatCountdown function
jest.mock("@/utils/format", () => ({
  formatCountdown: jest.fn((deadline: string, now: number) => {
    const deadlineMs = new Date(deadline).getTime();
    const diff = deadlineMs - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }),
}));

describe("RewardTierCard", () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders tier with discount badge and early-bird emoji", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Super Early Bird",
      description: "Limited time offer",
      amountXLM: "100.0000000",
      originalAmountXLM: "150.0000000",
      inventoryCap: 50,
      inventoryClaimed: 10,
      earlyBirdDeadline: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
      badgeLabel: "Early Bird",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: true,
      slotsRemaining: 40,
      isExpired: false,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.getByText(/Early Bird/i)).toBeInTheDocument();
    expect(screen.getByText("🐦")).toBeInTheDocument();
    expect(screen.getByText("Super Early Bird")).toBeInTheDocument();
    expect(screen.getByText("100.0000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("150.0000000 XLM")).toBeInTheDocument();
    expect(screen.getByText(/40 of 50/i)).toBeInTheDocument();
  });

  it("shows countdown when early-bird deadline is set", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Early Bird Tier",
      amountXLM: "100.0000000",
      inventoryClaimed: 0,
      earlyBirdDeadline: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
      badgeLabel: "Early Bird",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: true,
      isExpired: false,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.getByText(/Early-bird ends in:/i)).toBeInTheDocument();
    // The countdown should show some time value
    expect(screen.getByText(/h/)).toBeInTheDocument();
  });

  it("shows 'Sold Out' when inventory is exhausted", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Limited Tier",
      amountXLM: "100.0000000",
      inventoryCap: 10,
      inventoryClaimed: 10,
      badgeLabel: "Standard",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: false,
      slotsRemaining: 0,
      isExpired: false,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.getByText(/Sold Out/i)).toBeInTheDocument();
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("shows 'Expired' when deadline has passed", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Expired Tier",
      amountXLM: "100.0000000",
      inventoryClaimed: 0,
      earlyBirdDeadline: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      badgeLabel: "Early Bird",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: false,
      isExpired: true,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.getByText(/Expired/i)).toBeInTheDocument();
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("hides countdown for standard (non-early-bird) tiers", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Standard Tier",
      amountXLM: "100.0000000",
      inventoryClaimed: 0,
      badgeLabel: "Standard",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: true,
      isExpired: false,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.queryByText(/Early-bird ends in:/i)).not.toBeInTheDocument();
  });

  it("calls onSelect when the select button is clicked", async () => {
    const user = userEvent.setup();
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Available Tier",
      amountXLM: "100.0000000",
      inventoryClaimed: 0,
      badgeLabel: "Standard",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: true,
      isExpired: false,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    const button = screen.getByRole("button", { name: /Select This Tier/i });
    await user.click(button);

    expect(mockOnSelect).toHaveBeenCalledWith(tier);
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("displays inventory progress bar with correct color", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Almost Full Tier",
      amountXLM: "100.0000000",
      inventoryCap: 100,
      inventoryClaimed: 92,
      badgeLabel: "Standard",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: true,
      slotsRemaining: 8,
      isExpired: false,
    };

    const { container } = render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.getByText(/8 of 100/i)).toBeInTheDocument();
    // Check for the progress bar
    const progressBar = container.querySelector(".bg-yellow-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("shows 'Unlimited availability' for tiers without inventory cap", () => {
    const tier: CampaignRewardTier = {
      id: "tier-1",
      campaignId: "campaign-1",
      title: "Unlimited Tier",
      amountXLM: "100.0000000",
      inventoryClaimed: 50,
      badgeLabel: "Standard",
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      isAvailable: true,
      isExpired: false,
    };

    render(<RewardTierCard tier={tier} onSelect={mockOnSelect} />);

    expect(screen.getByText(/Unlimited availability/i)).toBeInTheDocument();
  });
});

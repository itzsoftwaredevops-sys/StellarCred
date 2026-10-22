/**
 * Migration 009: campaign_reward_tiers
 * 
 * Creates the campaign_reward_tiers table for time-limited and quantity-limited
 * early-bird discount tiers within donation campaigns.
 */

exports.up = async function (pool) {
  await pool.query(`
    CREATE TABLE campaign_reward_tiers (
      id UUID PRIMARY KEY,
      campaign_id UUID NOT NULL REFERENCES project_campaigns(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 120),
      description TEXT,
      amount_xlm NUMERIC(20, 7) NOT NULL CHECK (amount_xlm > 0),
      original_amount_xlm NUMERIC(20, 7) CHECK (original_amount_xlm IS NULL OR original_amount_xlm > amount_xlm),
      inventory_cap INTEGER CHECK (inventory_cap IS NULL OR inventory_cap > 0),
      inventory_claimed INTEGER NOT NULL DEFAULT 0 CHECK (inventory_claimed >= 0),
      early_bird_deadline TIMESTAMPTZ,
      badge_label TEXT NOT NULL DEFAULT 'Standard' CHECK (char_length(badge_label) <= 50),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT inventory_valid CHECK (inventory_cap IS NULL OR inventory_claimed <= inventory_cap)
    );

    CREATE INDEX idx_campaign_reward_tiers_campaign ON campaign_reward_tiers(campaign_id, display_order);
  `);
};

exports.down = async function (pool) {
  await pool.query(`
    DROP TABLE IF EXISTS campaign_reward_tiers CASCADE;
  `);
};

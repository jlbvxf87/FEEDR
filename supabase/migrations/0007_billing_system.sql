-- FEEDR - Billing & Payment System
-- Migration: 0007_billing_system.sql
-- Tracks API costs (what we pay) vs user charges (what they pay)

-- ============================================
-- UPDATE BATCHES TABLE FOR BILLING
-- ============================================

-- Rename cost_cents to base_cost_cents (what we pay to APIs)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS base_cost_cents INTEGER DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS user_charge_cents INTEGER DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS quality_mode TEXT DEFAULT 'good';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' 
  CHECK (payment_status IN ('pending', 'charged', 'failed', 'refunded', 'free'));

-- Migrate existing cost_cents data to base_cost_cents
UPDATE batches SET base_cost_cents = COALESCE(cost_cents, 0) WHERE base_cost_cents = 0;
UPDATE batches SET user_charge_cents = ROUND(base_cost_cents * 1.5) WHERE user_charge_cents = 0;

COMMENT ON COLUMN batches.base_cost_cents IS 'Our actual API cost in cents (what we pay)';
COMMENT ON COLUMN batches.user_charge_cents IS 'Amount charged to user in cents (base × 1.5)';
COMMENT ON COLUMN batches.quality_mode IS 'Quality tier: fast, good, better';
COMMENT ON COLUMN batches.payment_status IS 'Payment status: pending, charged, failed, refunded, free';

-- ============================================
-- USER CREDITS / BALANCE TABLE
-- For pay-as-you-go model
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_added_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_spent_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE user_credits IS 'User credit balance for pay-as-you-go billing';
COMMENT ON COLUMN user_credits.balance_cents IS 'Current available balance in cents';
COMMENT ON COLUMN user_credits.lifetime_added_cents IS 'Total credits ever added (purchases + bonuses)';
COMMENT ON COLUMN user_credits.lifetime_spent_cents IS 'Total credits ever spent on generations';

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);

-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- Full audit trail of all credit changes
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase',      -- User bought credits
    'generation',    -- Spent on batch generation
    'refund',        -- Refunded for failed generation
    'bonus',         -- Free credits (signup, promo, etc.)
    'subscription',  -- Monthly subscription credits
    'adjustment'     -- Manual admin adjustment
  )),
  description TEXT,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE credit_transactions IS 'Audit log of all credit transactions';
COMMENT ON COLUMN credit_transactions.amount_cents IS 'Positive for additions, negative for charges';
COMMENT ON COLUMN credit_transactions.balance_after_cents IS 'User balance after this transaction';
COMMENT ON COLUMN credit_transactions.stripe_payment_id IS 'Stripe payment intent ID for purchases';

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_batch ON credit_transactions(batch_id);

-- ============================================
-- PRICING TIERS TABLE
-- Store pricing configuration (updateable without code changes)
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value_json JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default pricing config
INSERT INTO pricing_config (key, value_json, description) VALUES 
  ('upsell_multiplier', '1.5', 'Multiplier applied to base cost (1.5 = 50% margin)'),
  ('free_credits_signup', '500', 'Free credits given on signup (in cents, e.g., 500 = $5)'),
  ('min_purchase_cents', '500', 'Minimum credit purchase amount (500 = $5)'),
  ('quality_tiers', '{
    "fast": {
      "label": "Fast",
      "script_model": "gpt-4o-mini",
      "voice_model": "openai-tts-1",
      "video_model": "sora",
      "image_model": "dall-e-2"
    },
    "good": {
      "label": "Good", 
      "script_model": "claude-3-5-haiku",
      "voice_model": "elevenlabs-turbo",
      "video_model": "sora",
      "image_model": "dall-e-3"
    },
    "better": {
      "label": "Better",
      "script_model": "claude-sonnet-4",
      "voice_model": "elevenlabs-standard", 
      "video_model": "sora",
      "image_model": "dall-e-3-hd"
    }
  }', 'Quality tier model configurations')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE pricing_config IS 'Dynamic pricing configuration';

-- ============================================
-- REVENUE TRACKING VIEW
-- Quick view of revenue vs costs
-- ============================================
CREATE OR REPLACE VIEW billing_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_batches,
  SUM(base_cost_cents) as total_api_cost_cents,
  SUM(user_charge_cents) as total_revenue_cents,
  SUM(user_charge_cents - base_cost_cents) as total_profit_cents,
  ROUND(AVG(user_charge_cents - base_cost_cents), 2) as avg_profit_per_batch_cents
FROM batches
WHERE status = 'done' AND payment_status = 'charged'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW billing_summary IS 'Daily billing summary: costs, revenue, profit';

-- ============================================
-- FUNCTION: Deduct credits for a batch
-- Called when user clicks GO
-- ============================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_batch_id UUID,
  p_amount_cents INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance with row lock
  SELECT balance_cents INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has enough credits
  IF v_current_balance IS NULL OR v_current_balance < p_amount_cents THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount_cents;
  
  -- Update balance
  UPDATE user_credits
  SET 
    balance_cents = v_new_balance,
    lifetime_spent_cents = lifetime_spent_cents + p_amount_cents,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents, 
    transaction_type, batch_id, description
  ) VALUES (
    p_user_id, -p_amount_cents, v_new_balance,
    'generation', p_batch_id, 'Batch generation'
  );
  
  -- Update batch payment status
  UPDATE batches
  SET payment_status = 'charged'
  WHERE id = p_batch_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deduct_credits IS 'Atomically deduct credits for a batch generation';

-- ============================================
-- FUNCTION: Add credits (purchase/bonus)
-- ============================================
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_stripe_payment_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Upsert user_credits record
  INSERT INTO user_credits (user_id, balance_cents, lifetime_added_cents)
  VALUES (p_user_id, p_amount_cents, p_amount_cents)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_cents = user_credits.balance_cents + p_amount_cents,
    lifetime_added_cents = user_credits.lifetime_added_cents + p_amount_cents,
    updated_at = now()
  RETURNING balance_cents INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents,
    transaction_type, description, stripe_payment_id
  ) VALUES (
    p_user_id, p_amount_cents, v_new_balance,
    p_type, p_description, p_stripe_payment_id
  );
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_credits IS 'Add credits to user account (purchase, bonus, etc.)';

-- ============================================
-- FUNCTION: Refund credits for failed batch
-- ============================================
CREATE OR REPLACE FUNCTION refund_batch(p_batch_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_charge_cents INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get batch info
  SELECT user_id, user_charge_cents INTO v_user_id, v_charge_cents
  FROM batches
  WHERE id = p_batch_id AND payment_status = 'charged';
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Refund credits
  UPDATE user_credits
  SET 
    balance_cents = balance_cents + v_charge_cents,
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance_cents INTO v_new_balance;
  
  -- Record refund transaction
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents,
    transaction_type, batch_id, description
  ) VALUES (
    v_user_id, v_charge_cents, v_new_balance,
    'refund', p_batch_id, 'Refund for failed batch'
  );
  
  -- Update batch status
  UPDATE batches
  SET payment_status = 'refunded'
  WHERE id = p_batch_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refund_batch IS 'Refund credits for a failed batch';

-- ============================================
-- TRIGGER: Auto-create user_credits on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user_credits() RETURNS TRIGGER AS $$
DECLARE
  v_signup_bonus INTEGER;
BEGIN
  -- Get signup bonus from config
  SELECT (value_json::TEXT)::INTEGER INTO v_signup_bonus
  FROM pricing_config WHERE key = 'free_credits_signup';
  
  v_signup_bonus := COALESCE(v_signup_bonus, 500); -- Default $5
  
  -- Create credits record with signup bonus
  INSERT INTO user_credits (user_id, balance_cents, lifetime_added_cents)
  VALUES (NEW.id, v_signup_bonus, v_signup_bonus);
  
  -- Record bonus transaction
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents,
    transaction_type, description
  ) VALUES (
    NEW.id, v_signup_bonus, v_signup_bonus,
    'bonus', 'Welcome bonus'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (only if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT USING (user_id = auth.uid());

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access to user_credits" ON user_credits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to credit_transactions" ON credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Pricing config is readable by all authenticated users
CREATE POLICY "Authenticated users can read pricing" ON pricing_config
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

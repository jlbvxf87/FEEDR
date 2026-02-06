-- Migration 0016: Add partial refund support for partially completed batches
--
-- Problem: When 3 of 4 clips succeed but 1 fails, the entire batch was marked
-- "failed" and fully refunded — wasting platform API spend on the 3 good clips.
--
-- Fix: Add a partial_refund function that refunds only the proportional cost
-- of failed clips. Batch stays "done" with completed clips available.

CREATE OR REPLACE FUNCTION partial_refund_batch(
  p_batch_id UUID,
  p_failed_count INTEGER,
  p_total_count INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_charge_cents INTEGER;
  v_refund_cents INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get batch info (only if charged, not already refunded)
  SELECT user_id, user_charge_cents INTO v_user_id, v_charge_cents
  FROM batches
  WHERE id = p_batch_id AND payment_status = 'charged';

  IF v_user_id IS NULL OR p_total_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- Calculate proportional refund (round up to be generous to user)
  v_refund_cents := CEIL(v_charge_cents::NUMERIC * p_failed_count / p_total_count);

  -- If all failed, refund everything
  IF p_failed_count >= p_total_count THEN
    v_refund_cents := v_charge_cents;
  END IF;

  -- Skip if nothing to refund
  IF v_refund_cents <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Refund proportional credits
  UPDATE user_credits
  SET
    balance_cents = balance_cents + v_refund_cents,
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance_cents INTO v_new_balance;

  -- Record partial refund transaction
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents,
    transaction_type, batch_id, description
  ) VALUES (
    v_user_id, v_refund_cents, v_new_balance,
    'refund', p_batch_id,
    'Partial refund: ' || p_failed_count || ' of ' || p_total_count || ' clips failed'
  );

  -- Update batch payment_status to reflect partial refund
  UPDATE batches
  SET payment_status = CASE
    WHEN p_failed_count >= p_total_count THEN 'refunded'
    ELSE 'partial_refund'
  END
  WHERE id = p_batch_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION partial_refund_batch(UUID, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION partial_refund_batch IS
  'Refund credits proportionally based on how many clips failed. Used for partial batch completion.';

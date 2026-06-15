DO $$
DECLARE
  uid TEXT;
  cids TEXT[];
  pipeline_id TEXT;
  stage_lead TEXT;
  stage_qualified TEXT;
  stage_proposal TEXT;
  stage_negotiation TEXT;
  stage_won TEXT;
  stage_lost TEXT;
  deal_ids TEXT[];
  tag_vip TEXT;
  tag_returning TEXT;
  tag_referral TEXT;
  tag_new TEXT;
  inv_ids TEXT[];
  i INT;
BEGIN
  SELECT id INTO uid FROM "User" WHERE email = 'tamar.shaked02@gmail.com';

  -- Update existing customers with CRM fields
  UPDATE "Customer" SET
    company = CASE name
      WHEN 'Noa Cohen' THEN 'TechStyle Ltd'
      WHEN 'Yael Levy' THEN 'Beauty Corp'
      WHEN 'Amit Ben David' THEN 'Startup Hub'
      WHEN 'Maya Friedman' THEN 'Maya Design Studio'
      WHEN 'Ori Shapira' THEN 'Shapira & Sons'
      WHEN 'Lior Katz' THEN NULL
      WHEN 'Dana Goldstein' THEN 'Goldstein Media'
      WHEN 'Rotem Alon' THEN 'Alon Consulting'
      WHEN 'Tomer Mizrahi' THEN 'Mizrahi Events'
      WHEN 'Shira Peretz' THEN NULL
      ELSE company
    END,
    "jobTitle" = CASE name
      WHEN 'Noa Cohen' THEN 'CEO'
      WHEN 'Yael Levy' THEN 'Marketing Director'
      WHEN 'Amit Ben David' THEN 'CTO'
      WHEN 'Maya Friedman' THEN 'Creative Director'
      WHEN 'Ori Shapira' THEN 'Managing Partner'
      WHEN 'Lior Katz' THEN 'Freelancer'
      WHEN 'Dana Goldstein' THEN 'Head of PR'
      WHEN 'Rotem Alon' THEN 'Senior Consultant'
      WHEN 'Tomer Mizrahi' THEN 'Event Planner'
      WHEN 'Shira Peretz' THEN 'Student'
      ELSE "jobTitle"
    END,
    "leadSource" = CASE name
      WHEN 'Noa Cohen' THEN 'Instagram'
      WHEN 'Yael Levy' THEN 'Referral'
      WHEN 'Amit Ben David' THEN 'Google'
      WHEN 'Maya Friedman' THEN 'Walk-in'
      WHEN 'Ori Shapira' THEN 'Referral'
      WHEN 'Lior Katz' THEN 'Instagram'
      WHEN 'Dana Goldstein' THEN 'Facebook'
      WHEN 'Rotem Alon' THEN 'Google'
      WHEN 'Tomer Mizrahi' THEN 'Referral'
      WHEN 'Shira Peretz' THEN 'TikTok'
      ELSE "leadSource"
    END,
    "lifecycleStage" = CASE name
      WHEN 'Noa Cohen' THEN 'vip'
      WHEN 'Yael Levy' THEN 'customer'
      WHEN 'Amit Ben David' THEN 'prospect'
      WHEN 'Maya Friedman' THEN 'customer'
      WHEN 'Ori Shapira' THEN 'vip'
      WHEN 'Lior Katz' THEN 'lead'
      WHEN 'Dana Goldstein' THEN 'customer'
      WHEN 'Rotem Alon' THEN 'prospect'
      WHEN 'Tomer Mizrahi' THEN 'customer'
      WHEN 'Shira Peretz' THEN 'lead'
      ELSE COALESCE("lifecycleStage", 'lead')
    END
  WHERE "userId" = uid;

  -- Get customer IDs array
  SELECT array_agg(id ORDER BY name) INTO cids FROM "Customer" WHERE "userId" = uid;

  -- Create Tags
  tag_vip := gen_random_uuid()::TEXT;
  tag_returning := gen_random_uuid()::TEXT;
  tag_referral := gen_random_uuid()::TEXT;
  tag_new := gen_random_uuid()::TEXT;

  INSERT INTO "Tag" (id, "userId", name, color, "createdAt") VALUES
    (tag_vip, uid, 'VIP', '#AB47BC', NOW()),
    (tag_returning, uid, 'Returning', '#66BB6A', NOW()),
    (tag_referral, uid, 'Referral', '#4FC3F7', NOW()),
    (tag_new, uid, 'New Client', '#FFB74D', NOW());

  -- Assign tags to contacts
  INSERT INTO "ContactTag" (id, "contactId", "tagId", "assignedAt") VALUES
    (gen_random_uuid(), cids[1], tag_vip, NOW()),
    (gen_random_uuid(), cids[1], tag_returning, NOW()),
    (gen_random_uuid(), cids[2], tag_returning, NOW()),
    (gen_random_uuid(), cids[2], tag_referral, NOW()),
    (gen_random_uuid(), cids[3], tag_new, NOW()),
    (gen_random_uuid(), cids[4], tag_returning, NOW()),
    (gen_random_uuid(), cids[5], tag_vip, NOW()),
    (gen_random_uuid(), cids[5], tag_referral, NOW()),
    (gen_random_uuid(), cids[6], tag_new, NOW()),
    (gen_random_uuid(), cids[7], tag_returning, NOW()),
    (gen_random_uuid(), cids[9], tag_referral, NOW()),
    (gen_random_uuid(), cids[10], tag_new, NOW());

  -- Create default Pipeline with Stages
  pipeline_id := gen_random_uuid()::TEXT;
  stage_lead := gen_random_uuid()::TEXT;
  stage_qualified := gen_random_uuid()::TEXT;
  stage_proposal := gen_random_uuid()::TEXT;
  stage_negotiation := gen_random_uuid()::TEXT;
  stage_won := gen_random_uuid()::TEXT;
  stage_lost := gen_random_uuid()::TEXT;

  INSERT INTO "Pipeline" (id, "userId", name, "isDefault", "createdAt", "updatedAt") VALUES
    (pipeline_id, uid, 'Sales Pipeline', true, NOW(), NOW());

  INSERT INTO "Stage" (id, "pipelineId", name, position, "isTerminal", "dealStatus", "createdAt") VALUES
    (stage_lead, pipeline_id, 'Lead', 0, false, NULL, NOW()),
    (stage_qualified, pipeline_id, 'Qualified', 1, false, NULL, NOW()),
    (stage_proposal, pipeline_id, 'Proposal', 2, false, NULL, NOW()),
    (stage_negotiation, pipeline_id, 'Negotiation', 3, false, NULL, NOW()),
    (stage_won, pipeline_id, 'Closed Won', 4, true, 'won', NOW()),
    (stage_lost, pipeline_id, 'Closed Lost', 5, true, 'lost', NOW());

  -- Create Deals
  deal_ids := ARRAY[]::TEXT[];
  FOR i IN 1..8 LOOP
    deal_ids := deal_ids || gen_random_uuid()::TEXT;
  END LOOP;

  INSERT INTO "Deal" (id, "userId", title, value, "expectedCloseDate", "winProbability", "pipelineId", "stageId", "contactId", status, "closedAt", "createdAt", "updatedAt") VALUES
    (deal_ids[1], uid, 'VIP Package - Annual', 4800.00, '2026-07-15', 85, pipeline_id, stage_negotiation, cids[1], 'open', NULL, NOW() - INTERVAL '20 days', NOW()),
    (deal_ids[2], uid, 'Corporate Team Styling', 3200.00, '2026-07-30', 60, pipeline_id, stage_proposal, cids[2], 'open', NULL, NOW() - INTERVAL '15 days', NOW()),
    (deal_ids[3], uid, 'Wedding Party Package', 2500.00, '2026-08-10', 40, pipeline_id, stage_qualified, cids[3], 'open', NULL, NOW() - INTERVAL '10 days', NOW()),
    (deal_ids[4], uid, 'Monthly Retainer - Styling', 1200.00, '2026-06-30', 90, pipeline_id, stage_won, cids[4], 'won', NOW() - INTERVAL '5 days', NOW() - INTERVAL '30 days', NOW()),
    (deal_ids[5], uid, 'Premium Color Package', 950.00, NULL, 30, pipeline_id, stage_lead, cids[5], 'open', NULL, NOW() - INTERVAL '3 days', NOW()),
    (deal_ids[6], uid, 'Event Styling Contract', 1800.00, '2026-08-20', 50, pipeline_id, stage_proposal, cids[9], 'open', NULL, NOW() - INTERVAL '12 days', NOW()),
    (deal_ids[7], uid, 'Product Bundle Order', 650.00, '2026-07-01', 70, pipeline_id, stage_negotiation, cids[7], 'open', NULL, NOW() - INTERVAL '8 days', NOW()),
    (deal_ids[8], uid, 'Consultation Package', 400.00, NULL, 20, pipeline_id, stage_lost, cids[8], 'lost', NOW() - INTERVAL '2 days', NOW() - INTERVAL '25 days', NOW());

  -- Link inventory items to some deals
  SELECT array_agg(id ORDER BY name) INTO inv_ids FROM "InventoryItem" WHERE "userId" = uid;

  INSERT INTO "DealItem" (id, "dealId", "inventoryItemId", quantity, "unitPrice", "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), deal_ids[1], inv_ids[1], 12, 45.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[1], inv_ids[2], 12, 52.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[1], inv_ids[6], 6, 35.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[2], inv_ids[3], 5, 89.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[2], inv_ids[5], 10, 28.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[4], inv_ids[7], 2, 62.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[4], inv_ids[8], 1, 120.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[7], inv_ids[1], 5, 45.00, NOW(), NOW()),
    (gen_random_uuid(), deal_ids[7], inv_ids[5], 8, 28.00, NOW(), NOW());

  -- Create Activities
  INSERT INTO "Activity" (id, "userId", type, description, metadata, "contactId", "dealId", "isSystem", "createdAt", "updatedAt") VALUES
    -- Deal stage changes
    (gen_random_uuid(), uid, 'deal_stage_change', 'Deal moved from "Lead" to "Qualified"', '{"fromStageName":"Lead","toStageName":"Qualified"}', cids[3], deal_ids[3], true, NOW() - INTERVAL '8 days', NOW()),
    (gen_random_uuid(), uid, 'deal_stage_change', 'Deal moved from "Qualified" to "Proposal"', '{"fromStageName":"Qualified","toStageName":"Proposal"}', cids[2], deal_ids[2], true, NOW() - INTERVAL '10 days', NOW()),
    (gen_random_uuid(), uid, 'deal_stage_change', 'Deal moved from "Proposal" to "Negotiation"', '{"fromStageName":"Proposal","toStageName":"Negotiation"}', cids[1], deal_ids[1], true, NOW() - INTERVAL '7 days', NOW()),
    (gen_random_uuid(), uid, 'deal_stage_change', 'Deal moved from "Negotiation" to "Closed Won"', '{"fromStageName":"Negotiation","toStageName":"Closed Won"}', cids[4], deal_ids[4], true, NOW() - INTERVAL '5 days', NOW()),
    (gen_random_uuid(), uid, 'deal_stage_change', 'Deal moved from "Proposal" to "Closed Lost"', '{"fromStageName":"Proposal","toStageName":"Closed Lost"}', cids[8], deal_ids[8], true, NOW() - INTERVAL '2 days', NOW()),
    -- Manual notes
    (gen_random_uuid(), uid, 'note', 'Called to discuss annual package pricing. Very interested in premium tier.', NULL, cids[1], deal_ids[1], false, NOW() - INTERVAL '12 days', NOW()),
    (gen_random_uuid(), uid, 'note', 'Sent proposal document via email. Waiting for feedback.', NULL, cids[2], deal_ids[2], false, NOW() - INTERVAL '9 days', NOW()),
    (gen_random_uuid(), uid, 'note', 'Initial consultation went well. Bride wants natural look for 6 bridesmaids.', NULL, cids[3], deal_ids[3], false, NOW() - INTERVAL '10 days', NOW()),
    (gen_random_uuid(), uid, 'note', 'Discussed preferred products and color preferences.', NULL, cids[5], NULL, false, NOW() - INTERVAL '3 days', NOW()),
    (gen_random_uuid(), uid, 'note', 'Follow-up scheduled for next week regarding the contract terms.', NULL, cids[7], deal_ids[7], false, NOW() - INTERVAL '4 days', NOW()),
    -- Calls
    (gen_random_uuid(), uid, 'call', 'Quick check-in about the ongoing retainer. Client very happy with service.', NULL, cids[4], NULL, false, NOW() - INTERVAL '6 days', NOW()),
    (gen_random_uuid(), uid, 'call', 'Discussed budget constraints. May need to adjust scope.', NULL, cids[8], deal_ids[8], false, NOW() - INTERVAL '4 days', NOW()),
    -- Meetings
    (gen_random_uuid(), uid, 'meeting', 'In-person consultation at the salon. Reviewed color options and pricing.', NULL, cids[1], deal_ids[1], false, NOW() - INTERVAL '18 days', NOW()),
    (gen_random_uuid(), uid, 'meeting', 'Virtual meeting to present corporate styling options.', NULL, cids[2], deal_ids[2], false, NOW() - INTERVAL '13 days', NOW()),
    (gen_random_uuid(), uid, 'meeting', 'Trial session for wedding party styling.', NULL, cids[3], deal_ids[3], false, NOW() - INTERVAL '6 days', NOW()),
    -- Appointments (system)
    (gen_random_uuid(), uid, 'appointment', 'Appointment "Haircut" completed', '{"appointmentTitle":"Haircut","price":120}', cids[1], NULL, true, NOW() - INTERVAL '14 days', NOW()),
    (gen_random_uuid(), uid, 'appointment', 'Appointment "Color Treatment" completed', '{"appointmentTitle":"Color Treatment","price":250}', cids[4], NULL, true, NOW() - INTERVAL '7 days', NOW()),
    (gen_random_uuid(), uid, 'appointment', 'Appointment "Blowout" completed', '{"appointmentTitle":"Blowout","price":80}', cids[5], NULL, true, NOW() - INTERVAL '5 days', NOW()),
    -- Task completed
    (gen_random_uuid(), uid, 'task_completed', 'Task "Send proposal to Yael" completed', '{"taskTitle":"Send proposal to Yael"}', cids[2], deal_ids[2], true, NOW() - INTERVAL '11 days', NOW());

  -- Create Automation Rules
  INSERT INTO "AutomationRule" (id, "userId", name, trigger, actions, enabled, position, "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), uid, 'Welcome new leads',
     '{"type":"deal_created"}',
     '[{"type":"create_task","params":{"title":"Follow up with new lead","dueDateOffsetDays":2}},{"type":"log_activity","params":{"activityType":"note","description":"New deal created - automated welcome task scheduled"}}]',
     true, 0, NOW(), NOW()),
    (gen_random_uuid(), uid, 'Notify on deal won',
     '{"type":"deal_stage_changed","params":{"targetStage":"Closed Won"}}',
     '[{"type":"change_contact_lifecycle","params":{"targetLifecycleStage":"customer"}},{"type":"log_activity","params":{"activityType":"note","description":"Deal won! Contact upgraded to customer."}}]',
     true, 1, NOW(), NOW()),
    (gen_random_uuid(), uid, 'Re-engage stale deals',
     '{"type":"deal_stale","params":{"inactiveDays":14}}',
     '[{"type":"create_task","params":{"title":"Re-engage stale deal","dueDateOffsetDays":1}}]',
     true, 2, NOW(), NOW());

  -- Link some tasks to contacts/deals
  UPDATE "Task" SET "contactId" = cids[1]
    WHERE id = (SELECT id FROM "Task" WHERE "userId" = uid AND "contactId" IS NULL LIMIT 1);
  UPDATE "Task" SET "contactId" = cids[2], "dealId" = deal_ids[2]
    WHERE id = (SELECT id FROM "Task" WHERE "userId" = uid AND "contactId" IS NULL AND id != (SELECT id FROM "Task" WHERE "userId" = uid AND "contactId" IS NOT NULL LIMIT 1) LIMIT 1);

END $$;

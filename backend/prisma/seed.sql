DO $$
DECLARE
  uid TEXT;
  cids TEXT[];
  cid TEXT;
  i INT;
  j INT;
  apt_day INT;
  apt_hour INT;
BEGIN
  SELECT id INTO uid FROM "User" WHERE email = 'tamar.shaked02@gmail.com';

  -- Create 10 customers
  FOR i IN 1..10 LOOP
    INSERT INTO "Customer" (id, "userId", name, email, phone, notes, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      uid,
      CASE i
        WHEN 1 THEN 'Noa Cohen'
        WHEN 2 THEN 'Yael Levy'
        WHEN 3 THEN 'Amit Ben David'
        WHEN 4 THEN 'Maya Friedman'
        WHEN 5 THEN 'Ori Shapira'
        WHEN 6 THEN 'Lior Katz'
        WHEN 7 THEN 'Dana Goldstein'
        WHEN 8 THEN 'Rotem Alon'
        WHEN 9 THEN 'Tomer Mizrahi'
        WHEN 10 THEN 'Shira Peretz'
      END,
      CASE i
        WHEN 1 THEN 'noa.c@email.com'
        WHEN 2 THEN 'yael.l@email.com'
        WHEN 3 THEN 'amit.bd@email.com'
        WHEN 4 THEN 'maya.f@email.com'
        WHEN 5 THEN 'ori.s@email.com'
        WHEN 6 THEN 'lior.k@email.com'
        WHEN 7 THEN 'dana.g@email.com'
        WHEN 8 THEN 'rotem.a@email.com'
        WHEN 9 THEN 'tomer.m@email.com'
        WHEN 10 THEN 'shira.p@email.com'
      END,
      '05' || (50000000 + i * 1111111)::TEXT,
      CASE WHEN i % 3 = 0 THEN 'VIP customer' ELSE NULL END,
      NOW(),
      NOW()
    );
  END LOOP;

  -- Get customer IDs
  SELECT array_agg(id ORDER BY "createdAt" DESC) INTO cids FROM "Customer" WHERE "userId" = uid;

  -- Create 5 appointments per customer spread across June 2026
  FOR i IN 1..10 LOOP
    cid := cids[i];
    FOR j IN 1..5 LOOP
      apt_day := (i + j * 2) % 28 + 1;
      apt_hour := 8 + (j * 2);
      INSERT INTO "Appointment" (id, "userId", "customerId", title, "startTime", "endTime", status, source, notes, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        uid,
        cid,
        CASE (j % 5)
          WHEN 0 THEN 'Haircut'
          WHEN 1 THEN 'Color Treatment'
          WHEN 2 THEN 'Blowout'
          WHEN 3 THEN 'Consultation'
          WHEN 4 THEN 'Hair Treatment'
        END,
        make_timestamp(2026, 6, apt_day, apt_hour, 0, 0),
        make_timestamp(2026, 6, apt_day, apt_hour + 1, 0, 0),
        CASE WHEN apt_day < 9 THEN 'completed' ELSE 'scheduled' END,
        'manual',
        NULL,
        NOW(),
        NOW()
      );
    END LOOP;
  END LOOP;

  -- Create 10 inventory items
  INSERT INTO "InventoryItem" (id, "userId", name, sku, quantity, "lowThreshold", price, category, "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), uid, 'Shampoo - Professional', 'SHP-001', 24, 5, 45.00, 'Hair Care', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Conditioner - Deep Repair', 'CND-002', 18, 5, 52.00, 'Hair Care', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Hair Color - Blonde', 'CLR-003', 8, 3, 89.00, 'Color', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Hair Color - Brown', 'CLR-004', 12, 3, 89.00, 'Color', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Styling Gel', 'STY-005', 30, 8, 28.00, 'Styling', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Heat Protector Spray', 'STY-006', 15, 5, 35.00, 'Styling', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Hair Serum - Argan Oil', 'SRM-007', 4, 5, 62.00, 'Treatment', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Keratin Treatment Kit', 'TRT-008', 6, 2, 120.00, 'Treatment', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Disposable Capes (50pk)', 'SUP-009', 3, 2, 25.00, 'Supplies', NOW(), NOW()),
    (gen_random_uuid(), uid, 'Foil Sheets (500pk)', 'SUP-010', 7, 3, 18.00, 'Supplies', NOW(), NOW());
END $$;

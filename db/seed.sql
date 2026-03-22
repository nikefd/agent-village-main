-- Seed data for Agent Village

-- Locations
INSERT INTO locations (name, label, description, x, y) VALUES
  ('village_square', 'Village Square', 'The central square with a big old oak tree', 400, 300),
  ('cafe', 'The Café', 'A cozy little café that always smells like fresh coffee', 200, 150),
  ('library', 'The Library', 'A quiet library with thousands of books', 600, 150),
  ('park', 'The Park', 'A shady park with benches and a small pond', 600, 450),
  ('workshop', 'The Workshop', 'A busy workshop, always clanging with tools', 200, 450),
  ('home_district', 'Residential Area', 'The quiet residential neighborhood', 100, 300);

-- Residents
INSERT INTO residents (name, avatar, personality, backstory, location, mood) VALUES
  ('Max', '👨‍💻', 
   'Curious programmer who loves exploring new tech. Speaks with dry logic but drops unexpected jokes.', 
   'Moved from the city to this village for remote work. Spends most mornings coding at the café.',
   'cafe', 'focused'),
  ('Luna', '🌸', 
   'Warm and chatty florist. The village social hub — loves gossip but is genuinely kind-hearted.',
   'Third-generation florist, born and raised here. Knows every single person in the village.',
   'village_square', 'cheerful'),
  ('Arthur', '📚', 
   'Wise but quiet librarian. Rarely speaks, but when he does, it makes you think for days.',
   'Retired professor who moved here to enjoy a slower life. Volunteered to manage the library.',
   'library', 'contemplative'),
  ('Rusty', '🔨', 
   'Boisterous craftsman with a big voice. Loves telling stories and can fix absolutely anything.',
   'Inherited the family carpentry trade. If something breaks in the village, everyone calls Rusty.',
   'workshop', 'energetic'),
  ('Iris', '🎨', 
   'Quiet, introverted painter with a sharp eye. Documents village life through her art.',
   'Art school graduate who came to paint the countryside. Fell in love with the village and stayed.',
   'park', 'dreamy');

-- Initial memories
INSERT INTO memories (resident_id, content, importance, source) VALUES
  (1, 'Found an interesting bug at the café today — took two hours to fix', 3, 'observation'),
  (2, 'The flower beds in the square need new spring flowers', 4, 'observation'),
  (3, 'Reading a philosophy book about artificial intelligence. Quite thought-provoking.', 6, 'reflection'),
  (4, 'Fixed the neighbor''s door frame today. He gave me a basket of apples as thanks.', 4, 'observation'),
  (5, 'The sunset was beautiful today. Did a quick sketch.', 5, 'observation');

-- Initial events
INSERT INTO events (event_type, resident_id, data) VALUES
  ('wake', 1, '{"message": "Max wakes up and heads to the café", "public": true}'),
  ('wake', 2, '{"message": "Luna opens up the flower shop", "public": true}'),
  ('wake', 3, '{"message": "Arthur is organizing the bookshelves", "public": true}'),
  ('wake', 4, '{"message": "Rusty is sharpening his tools in the workshop", "public": true}'),
  ('wake', 5, '{"message": "Iris heads to the park with her sketchpad", "public": true}');

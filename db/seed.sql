-- Seed data for Agent Village

-- 地点
INSERT INTO locations (name, label, description, x, y) VALUES
  ('village_square', '村广场', '村子中央的广场，有一棵大榕树', 400, 300),
  ('cafe', '咖啡馆', '温馨的小咖啡馆，总是飘着香气', 200, 150),
  ('library', '图书馆', '安静的图书馆，藏书万卷', 600, 150),
  ('park', '公园', '绿树成荫的小公园，有长椅和池塘', 600, 450),
  ('workshop', '工坊', '叮叮当当的手工工坊', 200, 450),
  ('home_district', '居民区', '安静的住宅区', 100, 300);

-- 居民
INSERT INTO residents (name, avatar, personality, backstory, location, mood) VALUES
  ('小明', '👨‍💻', 
   '好奇心旺盛的程序员，喜欢研究新技术，说话逻辑清晰但偶尔会冷笑话', 
   '从大城市搬来村子的年轻程序员，远程工作之余喜欢在咖啡馆写代码',
   'cafe', 'focused'),
  ('阿花', '🌸', 
   '热情开朗的花店老板，喜欢八卦但心地善良，是村里的社交中心',
   '土生土长的村民，家族三代开花店，认识村里每一个人',
   'village_square', 'cheerful'),
  ('老王', '📚', 
   '博学但话少的图书管理员，偶尔蹦出一句深刻的话让人沉思',
   '退休教授，来村子养老，自愿管理图书馆',
   'library', 'contemplative'),
  ('铁柱', '🔨', 
   '豪爽的手艺人，大嗓门，喜欢讲故事，动手能力极强',
   '祖传木匠手艺，村里什么东西坏了都找他修',
   'workshop', 'energetic'),
  ('小美', '🎨', 
   '安静内向的画家，观察力敏锐，用画记录村子的日常',
   '艺术系毕业后来村子采风，结果爱上了这里就留下了',
   'park', 'dreamy');

-- 初始记忆
INSERT INTO memories (resident_id, content, importance, source) VALUES
  (1, '今天在咖啡馆遇到了一个有趣的 bug，花了两小时才修好', 3, 'observation'),
  (2, '村广场的花坛需要换一批新花了，春天到了', 4, 'observation'),
  (3, '最近在读一本关于人工智能的哲学书，很有启发', 6, 'reflection'),
  (4, '帮邻居修好了门框，他送了一筐苹果作为感谢', 4, 'observation'),
  (5, '今天的夕阳特别美，画了一幅速写', 5, 'observation');

-- 初始事件
INSERT INTO events (event_type, resident_id, data) VALUES
  ('wake', 1, '{"message": "小明起床了，准备去咖啡馆"}'),
  ('wake', 2, '{"message": "阿花打开了花店的门"}'),
  ('wake', 3, '{"message": "老王在图书馆整理书架"}'),
  ('wake', 4, '{"message": "铁柱在工坊里磨工具"}'),
  ('wake', 5, '{"message": "小美带着画板去了公园"}');

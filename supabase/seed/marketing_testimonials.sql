-- Strativate homepage testimonial copy seed.
-- Images intentionally remain NULL. Upload the matching photos from Admin > Konten > Testimonials.
-- Competition names and achievements are retained from the approved source; public narratives are in English.
-- Rows are published already, but public RLS/homepage queries expose them only after image_path is populated.

insert into public.marketing_testimonials
  (slug, competition_name, achievement, testimonial, participant_label, image_path, alt_text, sort_order, is_published)
values
  (
    'yed-universitas-indonesia-bcc',
    'YED Universitas Indonesia BCC',
    '1st Place · Best Presentation',
    'We are truly grateful to Strativate for the guidance and valuable feedback throughout this journey. With Strativate’s support, our ideas became more structured and presentation-ready, giving us much more confidence during the final presentation. This process helped us achieve 1st Place and Best Presentation Winner. We are thankful for the mentoring, encouragement, and continued support throughout and beyond the competition.',
    'YED Universitas Indonesia BCC',
    null,
    'YED Universitas Indonesia BCC team after the competition.',
    1,
    true
  ),
  (
    'high-school-business-competition',
    'High School Business Competition',
    '1st Place',
    'We learned so much in only three mentoring sessions. The feedback we received helped us improve our pitch deck and business strategy. Strativate mentors shared practical business frameworks, presentation deck tips, and strategies that were very useful for our team. They were also approachable, making every session easy to follow and understand. We hope to join an offline mentoring session with Strativate one day.',
    'High School Business Competition Team',
    null,
    'High School Business Competition team with its competition award.',
    2,
    true
  ),
  (
    'undip-business-plan-competition',
    'UNDIP Business Plan Competition',
    '2nd Place',
    'Strativate mentors made every session structured and engaging. Their explanations were clear, well-paced, and easy to understand. Guidance on research, analysis, and pitch deck structure helped improve the quality of our work until we achieved 2nd Place in the Business Plan Competition. The mentors were also kind, humble, and always willing to answer our questions. We truly hope to join another Strativate mentoring session in the future.',
    'UNDIP Business Plan Competition Team',
    null,
    'UNDIP Business Plan Competition team with its second-place award.',
    3,
    true
  ),
  (
    'prasmul-ecc-first-place',
    'Business Plan Competition Prasmul ECC',
    '1st Place',
    'The five of us are very grateful to have been part of Strativate. Through the mentoring sessions, we learned how to build a Business Model Canvas and proposal correctly. Whenever we felt stuck or needed a new idea, Strativate mentors gave us clear, detailed, and practical feedback. In only six mentoring sessions, we won three different competitions and gained insights, confidence, teamwork, and learning experiences that we will carry forward.',
    'Prasmul ECC Team',
    null,
    'Business Plan Competition Prasmul ECC team with its first-place award.',
    4,
    true
  ),
  (
    'business-case-competition-first-place',
    'Business Case Competition',
    '1st Place',
    'We are very grateful to Strativate for providing an outstanding mentoring experience throughout our business competition journey. Special thanks to the mentors for such insightful sessions. Every topic was explained thoroughly with practical feedback until we truly understood it. This was our first Business Case Competition, and we achieved 1st Place. Thank you, Strativate, for encouraging our team to keep growing.',
    'Business Case Competition Team',
    null,
    'Business Case Competition team with its first-place award.',
    5,
    true
  ),
  (
    'economic-essay-competition-trisakti',
    'Economic Essay Competition Trisakti',
    '2nd Place',
    'At first, I was genuinely stuck. My ideas were scattered and I did not know how to turn them into a solid essay and presentation. Thanks to a Strativate mentor, everything became clearer. I built stronger arguments, structured my Theory of Change and solution more deliberately, and achieved 2nd Place. Thank you for the incredible guidance and support.',
    'Economic Essay Competition Trisakti Team',
    null,
    'Economic Essay Competition Trisakti team after achieving second place.',
    6,
    true
  ),
  (
    'business-case-competition-impact-ubm',
    'Business Case Competition IMPACT UBM',
    'Competition Awardee',
    'Behind every solid solution is an equally valuable mentoring process. Strativate mentors helped our team improve how we think, strengthen our narrative, and find gaps we had not noticed before. Every feedback session felt practical and insightful. With their guidance and support, we became much more confident and delivered our best performance in the competition.',
    'IMPACT UBM Team',
    null,
    'Business Case Competition IMPACT UBM team after the competition.',
    7,
    true
  ),
  (
    'prasmul-ecc-third-place',
    'Business Plan Competition Prasmul ECC',
    '3rd Place',
    'We are very grateful for the opportunity to learn with Strativate. The mentoring sessions helped us strengthen our business plan, improve our pitch deck, and build a clearer strategy. Every piece of feedback was practical, detailed, and easy to apply. With the guidance and continued support, we proudly achieved 3rd Place in our first business plan competition. We highly recommend Strativate.',
    'Prasmul ECC Team',
    null,
    'Business Plan Competition Prasmul ECC team with its third-place award.',
    8,
    true
  )
on conflict (slug) do nothing;

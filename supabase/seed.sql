insert into public.sources (name,kind,locator,enabled) values
('Real Engineering','youtube','UCR1IuLEqb6UEA_zQ81kwXfg',true),
('NASA Aeronautics','rss','https://www.nasa.gov/aeronautics/feed/',true),
('NASA / Quesst · X-59','rss','https://www.nasa.gov/blogs/quesst/feed/',true),
('Airbus / Commercial Aircraft','rss','https://www.airbus.com/en/generate-rss-feeds?tid=15571&fid=29711',true),
('Airbus / Defence','rss','https://www.airbus.com/en/generate-rss-feeds?tid=15576&fid=29721',true),
('Airbus / Innovation','rss','https://www.airbus.com/en/generate-rss-feeds?tid=15591&fid=29736',true),
('Boeing / Official Releases','rss','https://investors.boeing.com/rss/pressrelease.aspx',true),
('Lockheed Martin / Official Releases','rss','https://investors.lockheedmartin.com/rss/news-releases.xml',true),
('U.S. Air Force / Official News','rss','https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&isdashboardselected=0&max=20',true),
('GitHub / Aerodynamics','github','aerodynamics',true)
on conflict (kind,locator) do nothing;

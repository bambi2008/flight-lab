insert into public.sources (name,kind,locator,enabled) values
('Real Engineering','youtube','UCR1IuLEqb6UEA_zQ81kwXfg',true),
('NASA Aeronautics','rss','https://www.nasa.gov/aeronautics/feed/',true),
('Airbus / Commercial Aircraft','rss','https://www.airbus.com/en/generate-rss-feeds?tid=15571&fid=29711',true),
('Airbus / Defence','rss','https://www.airbus.com/en/generate-rss-feeds?tid=15576&fid=29721',true),
('Airbus / Innovation','rss','https://www.airbus.com/en/generate-rss-feeds?tid=15591&fid=29736',true),
('Boeing / Official Releases','rss','https://investors.boeing.com/rss/pressrelease.aspx',true),
('GitHub / Aerodynamics','github','aerodynamics',true)
on conflict (kind,locator) do nothing;

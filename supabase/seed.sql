insert into public.sources (name,kind,locator,enabled) values
('Real Engineering','youtube','UCR1IuLEqb6UEA_zQ81kwXfg',true),
('NASA Aeronautics','rss','https://www.nasa.gov/aeronautics/feed/',true),
('GitHub / Aerodynamics','github','aerodynamics',true)
on conflict (kind,locator) do nothing;

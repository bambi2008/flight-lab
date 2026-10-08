-- Run only in this project's SQL editor, after configuring the Edge Function.
-- Enable pg_cron, pg_net, and Vault in the dashboard first.
-- Replace placeholders locally. Do not commit or share completed secrets.
-- Store the SAME random secret in Edge Function secrets as INGEST_CRON_SECRET.
select vault.create_secret('REPLACE_WITH_RANDOM_CRON_SECRET', 'flight_lab_cron_secret');
select vault.create_secret('https://REPLACE_PROJECT_REF.supabase.co/functions/v1/ingest', 'flight_lab_ingest_url');

-- Three runs a day: 09:00, 17:00, 01:00 Asia/Shanghai. pg_cron uses UTC.
select cron.schedule('flight-lab-ingest', '0 1,9,17 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='flight_lab_ingest_url'),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='flight_lab_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);

-- Pause with: select cron.unschedule('flight-lab-ingest');

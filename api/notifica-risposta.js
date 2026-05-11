const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  const { stato, veicolo } = req.body;
  
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const { data } = await supabase
    .from('push_subscription')
    .select('subscription');

  const messaggio = {
    title: stato === 'accettato' ? '✅ Preventivo Accettato!' : '❌ Preventivo Rifiutato',
    body: `${veicolo}`,
    url: '/archivio'
  };

  for (const row of data || []) {
    await webpush.sendNotification(
      row.subscription,
      JSON.stringify(messaggio)
    );
  }

  res.json({ ok: true });
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fax-webhook-secret'
};

type FaxRecord = {
    id: string;
    sender_user_id: string;
    recipient_station_id: string;
    content: string;
};

type WebhookPayload = {
    type: string;
    table: string;
    record: FaxRecord;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const webhookSecret = Deno.env.get('FAX_WEBHOOK_SECRET');
    if (webhookSecret && req.headers.get('x-fax-webhook-secret') !== webhookSecret) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:faxchat@local';

    if (!vapidPublic || !vapidPrivate) {
        return new Response('VAPID keys missing', { status: 500, headers: corsHeaders });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    let body: WebhookPayload;
    try {
        body = await req.json();
    } catch {
        return new Response('Bad JSON', { status: 400, headers: corsHeaders });
    }

    if (body.type !== 'INSERT' || body.table !== 'faxes' || !body.record) {
        return new Response(JSON.stringify({ skipped: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const fax = body.record;
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: recipient } = await supabase
        .from('profiles')
        .select('id, name, station_id')
        .eq('station_id', fax.recipient_station_id)
        .maybeSingle();

    if (!recipient) {
        return new Response(JSON.stringify({ error: 'recipient not found' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { data: sender } = await supabase
        .from('profiles')
        .select('name, station_id, fax_label')
        .eq('id', fax.sender_user_id)
        .maybeSingle();

    const senderLabel = sender
        ? `${sender.name.toUpperCase()} (NR ${sender.station_id})`
        : 'UKJENT';

    const preview = fax.content.length > 90 ? `${fax.content.slice(0, 90)}…` : fax.content;

    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('user_id', recipient.id);

    const payload = JSON.stringify({
        title: 'NY FAX MOTTATT',
        body: `${senderLabel}: ${preview}`,
        url: '/',
        tag: `fax-${fax.id}`
    });

    let sent = 0;
    const staleIds: string[] = [];

    for (const row of subs || []) {
        try {
            await webpush.sendNotification(row.subscription, payload);
            sent++;
        } catch (err: unknown) {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) {
                staleIds.push(row.id);
            }
            console.error('push failed', row.id, err);
        }
    }

    if (staleIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', staleIds);
    }

    return new Response(JSON.stringify({ sent, recipient: recipient.station_id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
});

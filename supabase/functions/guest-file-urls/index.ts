import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as { code?: unknown; paths?: unknown };
    if (
      typeof body.code !== 'string' ||
      !Array.isArray(body.paths) ||
      body.paths.some((path) => typeof path !== 'string') ||
      body.paths.length > 100
    ) {
      return Response.json(
        { error: 'Invalid guest file request.' },
        { status: 400, headers: corsHeaders },
      );
    }

    const paths = [...new Set(body.paths as string[])];
    if (paths.length === 0) {
      return Response.json({ urls: {} }, { headers: corsHeaders });
    }

    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );
    const requestId = crypto.randomUUID();
    const authorization = await client.rpc('authorize_guest_files', {
      p_code: body.code,
      p_paths: paths,
      p_request_id: requestId,
    });
    if (
      authorization.error ||
      !authorization.data ||
      authorization.data.length !== paths.length
    ) {
      return Response.json(
        { error: 'Guest file unavailable.', requestId },
        { status: 404, headers: corsHeaders },
      );
    }

    const signed = await client.storage
      .from('trip-files')
      .createSignedUrls(authorization.data, 15 * 60);
    if (signed.error) throw signed.error;

    const urls = Object.fromEntries(
      (signed.data ?? []).flatMap((file) =>
        file.path && file.signedUrl ? [[file.path, file.signedUrl]] : [],
      ),
    );
    return Response.json({ urls }, { headers: corsHeaders });
  } catch {
    return Response.json(
      { error: 'Unable to sign guest files.' },
      { status: 500, headers: corsHeaders },
    );
  }
});

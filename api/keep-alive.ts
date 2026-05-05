import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Prefer service role on the server: RLS on rental_records/jcb_records only allows `authenticated`, not `anon`
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ 
      error: 'Missing Supabase configuration',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or anon key in Vercel env'
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lightweight head request: still hits Postgres (counts as project activity)
    const { error } = await supabase
      .from('rental_records')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      console.error('Supabase keep-alive failed:', error);
      return res.status(500).json({ 
        error: 'Database connection failed',
        message: error.message 
      });
    }

    // Success - database is active
    const timestamp = new Date().toISOString();
    console.log(`✅ Keep-alive successful at ${timestamp}`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Database keep-alive successful',
      timestamp
    });
  } catch (error: any) {
    console.error('Keep-alive error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error occurred'
    });
  }
}

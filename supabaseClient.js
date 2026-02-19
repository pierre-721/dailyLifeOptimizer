// 1) Renseignez vos valeurs Supabase
// Project Settings -> API -> Project URL / anon public key
const SUPABASE_URL = "https://bjnqcxunukbckquyrbpu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IHRpQtrTP5ohHl2chvfYUw_bM3pDABt";

// 2) Client Supabase
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

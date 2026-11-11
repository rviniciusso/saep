// Credenciais do projeto Supabase (Project Settings > API)
const SUPABASE_URL = 'https://hqjexwjwopspvambldew.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IadiN4ZnMASIYiPTc_9LJw_XWprtL_4';

// Redefine a variavel global 'supabase' (SDK) para o cliente instanciado.
// Usamos 'var' para permitir a redeclaracao do 'var supabase' criado pelo SDK UMD.
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

const { supabaseUrl, supabaseAnonKey } = getEnv();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

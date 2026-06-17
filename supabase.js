import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://dorassgqhigcbohatnjr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcmFzc2dxaGlnY2JvaGF0bmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjI4NTksImV4cCI6MjA5MDYzODg1OX0.-fVFp1mm4Ra06AHH3y5eAGFopnTi5rqpGK4zSYfE6Wc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

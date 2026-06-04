import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://emwweakebypdgylxuszs.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtd3dlYWtlYnlwZGd5bHh1c3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTY1MTEsImV4cCI6MjA5NTIzMjUxMX0.rt3aqKjIzlnJW6IDcL0Dys8SrIiTyVKN3Kb3AUUzvVw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
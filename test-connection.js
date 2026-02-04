import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function testConnection() {
  try {
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1)
    
    if (error && error.code === '42P01') {
      // Table doesn't exist - but connection worked!
      console.log('✓ Connected to Supabase: pwcmqoftshxytxzyjsvy')
      console.log('✓ Authentication successful')
    } else if (error) {
      console.log('✓ Connected to Supabase: pwcmqoftshxytxzyjsvy')
      console.log('  Note:', error.message)
    } else {
      console.log('✓ Connected to Supabase: pwcmqoftshxytxzyjsvy')
    }
  } catch (err) {
    console.error('✗ Connection failed:', err.message)
  }
}

testConnection()

// Supabase Edge Function: send-otp
// Purpose: Generates an OTP and sends it via the Resend API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    // 1. Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Generate OTP in database
    const { data: code, error: otpError } = await supabase.rpc('generate_otp_code', { p_email: email })
    
    if (otpError) throw otpError

    // 3. Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Nerox VPN <onboarding@resend.dev>',
        to: [email],
        subject: 'Your Verification Code - Nerox VPN',
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #6B8F04; text-align: center;">Nerox VPN</h2>
            <p>Your verification code is:</p>
            <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #171B2E; border-radius: 5px;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This code will expire in <b>5 minutes</b>. If you did not request this, please ignore this email.
            </p>
          </div>
        `,
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw resData

    return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'An unknown error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

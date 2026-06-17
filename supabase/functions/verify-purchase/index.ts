import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { platform, productId, purchaseToken, userId } = await req.json()

    // Setup Supabase Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let isValid = false
    let verificationData = {}

    // 2. VALIDATION LOGIC
    if (platform === 'android') {
      // GOOGLE PLAY VALIDATION
      // Requires: GOOGLE_SERVICE_ACCOUNT_JSON env variable
      // In a real production setup, you would use the 'google-play-billing' npm package or fetch the Google Auth API.
      // Template for actual Google API call:
      /*
      const googleToken = await getGoogleAccessToken(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON'));
      const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      verificationData = await response.json();
      isValid = verificationData.paymentState === 1;
      */
      
      // MOCK for demonstration (Replace with actual Google API call)
      console.log("Verifying Android token:", purchaseToken);
      isValid = true; // Placeholder for production verification
    } else {
      // APPLE APP STORE VALIDATION
      // Requires: APPLE_SHARED_SECRET env variable
      /*
      const response = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        body: JSON.stringify({ 'receipt-data': purchaseToken, 'password': Deno.env.get('APPLE_SHARED_SECRET') })
      });
      verificationData = await response.json();
      isValid = verificationData.status === 0;
      */
      
      // MOCK for demonstration (Replace with actual Apple API call)
      console.log("Verifying iOS receipt:", purchaseToken);
      isValid = true; // Placeholder for production verification
    }

    if (!isValid) {
      return new Response(JSON.stringify({ success: false, message: "Invalid payment token" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. DATABASE UPDATE (Trusted Environment)
    // Fetch plan details
    const { data: plan } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq(platform === 'android' ? 'google_product_id' : 'apple_product_id', productId)
      .single()

    if (!plan) throw new Error("Plan not found");

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + plan.duration_months);

    // Create/Update Subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan_id: plan.plan_id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
        payment_method: platform === 'android' ? 'Google Play' : 'Apple IAP'
      })
      .select()
      .single()

    if (subError) throw subError;

    // Log Transaction
    await supabaseAdmin.from('payment_transactions').insert({
      subscription_id: subscription.subscription_id,
      amount: plan.price_usd,
      status: 'completed',
      platform: platform,
      purchase_token: purchaseToken,
      verification_response: verificationData
    })

    return new Response(JSON.stringify({ success: true, message: "Subscription activated!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

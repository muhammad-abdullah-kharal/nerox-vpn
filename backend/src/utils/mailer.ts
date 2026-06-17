export const sendOtpEmail = async (email: string, code: string) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  const response = await fetch('https://api.resend.com/emails', {
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
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Resend API Error:', data);
    throw new Error('Failed to send email');
  }
  return data;
};

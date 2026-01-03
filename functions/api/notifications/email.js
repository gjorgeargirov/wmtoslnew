// Pages Function for sending email notifications
export async function onRequestPost(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  try {
    const { to, subject, body, migrationData } = await request.json();

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Email service integration
    // Supports Brevo (Sendinblue), SendGrid, Mailgun, or custom email service
    // Configure EMAIL_SERVICE_API_KEY in Cloudflare Dashboard
    
    const emailServiceKey = env.EMAIL_SERVICE_API_KEY;
    const emailServiceType = env.EMAIL_SERVICE_TYPE || 'brevo'; // 'brevo', 'sendgrid', 'mailgun', or 'custom'
    const emailFrom = env.EMAIL_FROM || 'noreply@iwconnect.com';
    const emailFromName = env.EMAIL_FROM_NAME || 'IWConnect Migration Accelerator';
    
    if (!emailServiceKey) {
      // If no email service configured, log the email (for development)
      console.log('📧 Email would be sent (no service configured):', {
        to,
        subject,
        body: body.substring(0, 100) + '...',
        migrationData
      });
      
      // Return success in development mode
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email logged (no email service configured)',
        debug: { to, subject },
        note: 'Configure EMAIL_SERVICE_API_KEY in Cloudflare Dashboard to enable email sending'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let emailResponse;
    
    // Brevo (Sendinblue) integration
    if (emailServiceType === 'brevo' || emailServiceType === 'sendinblue') {
      const brevoPayload = {
        sender: {
          name: emailFromName,
          email: emailFrom
        },
        to: [{
          email: to
        }],
        subject: subject,
        htmlContent: body
      };
      
      emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': emailServiceKey,
        },
        body: JSON.stringify(brevoPayload),
      });
    }
    // SendGrid integration
    else if (emailServiceType === 'sendgrid') {
      const sendGridPayload = {
        personalizations: [{
          to: [{ email: to }],
          subject: subject
        }],
        from: { 
          email: emailFrom,
          name: emailFromName
        },
        content: [{
          type: 'text/html',
          value: body
        }]
      };
      
      emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailServiceKey}`,
        },
        body: JSON.stringify(sendGridPayload),
      });
    }
    // Mailgun integration
    else if (emailServiceType === 'mailgun') {
      const emailServiceUrl = env.EMAIL_SERVICE_URL || 'https://api.mailgun.net/v3';
      const mailgunDomain = env.MAILGUN_DOMAIN || emailServiceUrl.match(/v3\/([^\/]+)/)?.[1];
      const mailgunUrl = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
      
      const formData = new FormData();
      formData.append('from', `${emailFromName} <${emailFrom}>`);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('html', body);
      
      emailResponse = await fetch(mailgunUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${emailServiceKey}`)}`,
        },
        body: formData,
      });
    }
    // Custom email service
    else {
      const emailServiceUrl = env.EMAIL_SERVICE_URL;
      if (!emailServiceUrl) {
        throw new Error('EMAIL_SERVICE_URL is required for custom email service');
      }
      
      const emailContent = {
        to: to,
        subject: subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        migrationData: migrationData || {}
      };

      emailResponse = await fetch(emailServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailServiceKey}`,
        },
        body: JSON.stringify(emailContent),
      });
    }

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Email service error: ${errorResponse.status} - ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Send email error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

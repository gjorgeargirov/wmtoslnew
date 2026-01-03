# Email Service Setup Guide

This guide explains how to configure email notifications for migration completion.

## Quick Setup Options

### Option 1: Brevo (Sendinblue) - Recommended - Free Tier Available

1. **Sign up for Brevo:**
   - Go to https://www.brevo.com (formerly Sendinblue)
   - Create a free account (300 emails/day free)

2. **Get your API Key:**
   - Log in to Brevo Dashboard
   - Go to **Settings** → **SMTP & API** → **API Keys**
   - Click **Generate a new API key**
   - Name it (e.g., "Migration Accelerator")
   - Click **Generate**
   - **Copy the API key immediately** (you'll see it only once!)

3. **Verify your sender email:**
   - Go to **Senders** → **Add a sender**
   - Add and verify your email address (e.g., noreply@yourdomain.com)

4. **Configure in Cloudflare:**
   - Go to Cloudflare Dashboard → **Workers & Pages** → Your Project → **Settings** → **Environment Variables**
   - Add these variables for **Production**:
     - `EMAIL_SERVICE_TYPE` = `brevo`
     - `EMAIL_SERVICE_API_KEY` = `your_brevo_api_key_here` (paste your API key)
     - `EMAIL_FROM` = `noreply@yourdomain.com` (your verified sender email)
     - `EMAIL_FROM_NAME` = `IWConnect Migration Accelerator` (optional)

### Option 2: SendGrid (Free Tier Available)

1. **Sign up for SendGrid:**
   - Go to https://sendgrid.com
   - Create a free account (100 emails/day free)

2. **Get your API Key:**
   - Log in to SendGrid Dashboard
   - Go to **Settings** → **API Keys**
   - Click **Create API Key**
   - Name it (e.g., "Migration Accelerator")
   - Select **Full Access** or **Restricted Access** with Mail Send permissions
   - Click **Create & View**
   - **Copy the API key immediately** (you won't see it again!)

3. **Verify your sender email:**
   - Go to **Settings** → **Sender Authentication**
   - Verify a single sender or set up domain authentication

4. **Configure in Cloudflare:**
   - Go to Cloudflare Dashboard → **Workers & Pages** → Your Project → **Settings** → **Environment Variables**
   - Add these variables:
     - `EMAIL_SERVICE_TYPE` = `sendgrid`
     - `EMAIL_SERVICE_API_KEY` = `SG.your_api_key_here` (paste your SendGrid API key)
     - `EMAIL_FROM` = `noreply@yourdomain.com` (your verified sender email)

### Option 2: Mailgun (Free Tier Available)

1. **Sign up for Mailgun:**
   - Go to https://www.mailgun.com
   - Create a free account (5,000 emails/month free for 3 months, then 1,000/month)

2. **Get your API Key:**
   - Log in to Mailgun Dashboard
   - Go to **Sending** → **API Keys**
   - Copy your **Private API key**

3. **Get your domain:**
   - Mailgun provides a sandbox domain (e.g., `sandbox1234567890.mailgun.org`)
   - Or add your own domain in **Sending** → **Domains**

4. **Configure in Cloudflare:**
   - Go to Cloudflare Dashboard → **Workers & Pages** → Your Project → **Settings** → **Environment Variables**
   - Add these variables:
     - `EMAIL_SERVICE_TYPE` = `mailgun`
     - `EMAIL_SERVICE_URL` = `https://api.mailgun.net/v3/YOUR_DOMAIN` (replace YOUR_DOMAIN)
     - `EMAIL_SERVICE_API_KEY` = `your_mailgun_api_key_here`
     - `EMAIL_FROM` = `noreply@yourdomain.com`

### Option 3: AWS SES (For AWS Users)

1. **Set up AWS SES:**
   - Go to AWS Console → **Simple Email Service (SES)**
   - Verify your email address or domain
   - Create IAM user with SES permissions
   - Generate Access Key and Secret Key

2. **Configure in Cloudflare:**
   - Add these variables:
     - `EMAIL_SERVICE_TYPE` = `custom`
     - `EMAIL_SERVICE_URL` = `https://email.us-east-1.amazonaws.com` (adjust region)
     - `EMAIL_SERVICE_API_KEY` = `your_aws_access_key`
     - `EMAIL_SERVICE_SECRET` = `your_aws_secret_key` (if needed)

## Setting Environment Variables in Cloudflare

1. Go to **Cloudflare Dashboard**
2. Navigate to **Workers & Pages**
3. Select your project (`wmtoslnew`)
4. Go to **Settings** tab
5. Scroll to **Environment Variables** section
6. Click **Add variable** for each variable:
   - `EMAIL_SERVICE_TYPE` (Production)
   - `EMAIL_SERVICE_API_KEY` (Production)
   - `EMAIL_SERVICE_URL` (Production, if using Mailgun or custom)
   - `EMAIL_FROM` (Production)

**Important:** Make sure to set these for the **Production** environment!

## Testing Email Notifications

1. Enable email notifications in your profile:
   - Go to **My Profile**
   - Enable **Email Notifications** toggle
   - Click **Save Preferences**

2. Start a migration and wait for it to complete

3. Check your email inbox for the notification

## Troubleshooting

- **No emails received:**
  - Check Cloudflare Dashboard → Workers & Pages → Your Project → **Logs** for errors
  - Verify API keys are correct
  - Check spam folder
  - Ensure sender email is verified in your email service

- **API errors:**
  - Verify your API key has correct permissions
  - Check that EMAIL_FROM matches a verified sender in your email service
  - Review Cloudflare function logs for detailed error messages

## Development Mode

If no email service is configured, emails will be logged to the console instead of being sent. This allows you to test the functionality without setting up an email service.

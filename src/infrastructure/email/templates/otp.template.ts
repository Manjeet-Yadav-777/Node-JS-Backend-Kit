export interface OtpEmailProps {
  otp: string;
  name?: string;
  expiresInMinutes?: number;
  purpose?: string;
  supportEmail?: string;
}

/**
 * Generates a responsive HTML email template for One-Time Password (OTP) verification.
 */
export function renderOtpEmail(props: OtpEmailProps): string {
  const expiresInMinutes = props.expiresInMinutes ?? 10;
  const purpose = props.purpose ?? 'verification';
  const supportEmail = props.supportEmail ?? 'support@example.com';
  const greeting = props.name ? `Hi <strong>${props.name}</strong>,` : 'Hello,';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your One-Time Password (OTP)</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f5f7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #333333;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: #4f46e5;
      padding: 30px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .content {
      padding: 30px;
      line-height: 1.6;
    }
    .content p {
      margin: 0 0 16px;
      font-size: 16px;
    }
    .otp-container {
      text-align: center;
      margin: 30px 0;
    }
    .otp-code {
      display: inline-block;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #4f46e5;
      background: #eef2ff;
      border: 1px dashed #6366f1;
      border-radius: 8px;
      padding: 16px 28px;
    }
    .warning-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 14px;
      color: #92400e;
      border-radius: 4px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Account Verification</h1>
    </div>
    <div class="content">
      <p>${greeting}</p>
      <p>Use the following one-time password (OTP) to complete your ${purpose}. This code is valid for <strong>${expiresInMinutes} minutes</strong>.</p>
      <div class="otp-container">
        <div class="otp-code">${props.otp}</div>
      </div>
      <div class="warning-box">
        <strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your OTP. If you did not request this code, please contact <a href="mailto:${supportEmail}">${supportEmail}</a> immediately.
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

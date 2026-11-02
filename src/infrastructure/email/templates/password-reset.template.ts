export interface PasswordResetEmailProps {
  resetToken: string;
  resetUrl?: string;
  expiresInMinutes?: number;
  supportEmail?: string;
}

/**
 * Generates responsive HTML email template for password reset requests.
 */
export function renderPasswordResetEmail(props: PasswordResetEmailProps): string {
  const expiresInMinutes = props.expiresInMinutes ?? 15;
  const resetUrl =
    props.resetUrl ??
    `http://localhost:5000/api/v1/auth/reset-password?token=${encodeURIComponent(props.resetToken)}`;
  const supportEmail = props.supportEmail ?? 'support@example.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
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
      background: #dc2626;
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
    .btn-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      background-color: #dc2626;
      color: #ffffff !important;
      padding: 12px 28px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 6px;
      display: inline-block;
    }
    .warning-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 14px;
      color: #991b1b;
      border-radius: 4px;
    }
    .token-box {
      background-color: #f3f4f6;
      border: 1px dashed #9ca3af;
      padding: 12px;
      text-align: center;
      font-family: monospace;
      font-size: 14px;
      word-break: break-all;
      margin: 16px 0;
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
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset the password for your account.</p>
      <p>Click the button below to choose a new password. This link is valid for <strong>${expiresInMinutes} minutes</strong>.</p>
      <div class="btn-container">
        <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
      </div>
      <p>Or use your reset token directly in your API client:</p>
      <div class="token-box">${props.resetToken}</div>
      <div class="warning-box">
        <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email or contact support at <a href="mailto:${supportEmail}">${supportEmail}</a> immediately.
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

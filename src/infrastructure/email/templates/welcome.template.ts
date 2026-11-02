export interface WelcomeEmailProps {
  name: string;
  loginUrl?: string;
  supportEmail?: string;
}

/**
 * Generates responsive HTML email template for new user onboarding.
 */
export function renderWelcomeEmail(props: WelcomeEmailProps): string {
  const loginUrl = props.loginUrl ?? 'http://localhost:5000/login';
  const supportEmail = props.supportEmail ?? 'support@example.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Our Platform</title>
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
    .btn-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 12px 28px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 6px;
      display: inline-block;
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
      <h1>Welcome to Our Platform</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${props.name}</strong>,</p>
      <p>Thank you for signing up. Your account is now active and ready to go.</p>
      <p>Get started by exploring our platform through the link below:</p>
      <div class="btn-container">
        <a href="${loginUrl}" class="btn" target="_blank">Go to Dashboard</a>
      </div>
      <p>If you have any questions or need help, reply to this email or reach us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

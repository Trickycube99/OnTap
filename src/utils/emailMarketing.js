/**
 * CAN-SPAM Act (15 U.S.C. § 7704(a)(5)) & Electronic Messaging Compliance Engine
 * 
 * Statutory Mandates:
 * 1. Mandatory Unsubscribe Mechanism: Clear and conspicuous opt-out / unsubscribe link in every commercial email.
 * 2. Physical Postal Address: Clear and conspicuous display of the sender's valid physical street address.
 * 3. Prompt Opt-Out Processing: Honoring unsubscribe requests within 10 business days.
 */

export const COMPANY_LEGAL_ADDRESS = {
  name: 'OnTap Platform Technologies Inc.',
  street: '100 Innovation Way, Suite 400',
  city: 'Wilmington',
  state: 'DE',
  zip: '19801',
  country: 'United States',
  formatted: 'OnTap Platform Technologies Inc., 100 Innovation Way, Suite 400, Wilmington, DE 19801, USA',
  regionalOffice: 'OnTap Technologies India Pvt. Ltd., Level 6, Prestige Meridian, MG Road, Bengaluru, Karnataka 560001, India'
};

/**
 * Generate a CAN-SPAM compliant unsubscribe link for a recipient
 */
export function generateUnsubscribeLink(recipientEmail, businessId = 'platform') {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ontap.app';
  const cleanEmail = encodeURIComponent(recipientEmail || '');
  const cleanBiz = encodeURIComponent(businessId || 'platform');
  return `${baseUrl}/#unsubscribe?email=${cleanEmail}&bid=${cleanBiz}`;
}

/**
 * Format any outgoing marketing / promotional email with mandatory CAN-SPAM compliance footer
 */
export function formatMarketingEmail({
  recipientEmail,
  recipientName = 'Valued Customer',
  subject,
  bodyContent,
  businessName = 'OnTap Dining & Restaurant OS',
  businessAddress = null,
  businessId = 'platform'
}) {
  const unsubscribeUrl = generateUnsubscribeLink(recipientEmail, businessId);
  const physicalAddress = businessAddress || COMPANY_LEGAL_ADDRESS.formatted;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject || 'Notice'}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #0F172A;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 8px;">${businessName}</h2>
      <div style="height: 2px; width: 40px; background: #007AFF;"></div>
    </div>
    
    <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 32px;">
      ${bodyContent}
    </div>

    <!-- CAN-SPAM Act Mandatory Legal Footer -->
    <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; font-size: 11px; line-height: 1.5; color: #64748B;">
      <p style="margin: 0 0 6px;">
        You are receiving this communication from <strong>${businessName}</strong> because you opted in or engaged in dining services.
      </p>
      <p style="margin: 0 0 6px;">
        <strong>Our Physical Postal Address:</strong><br />
        ${physicalAddress}<br />
        ${COMPANY_LEGAL_ADDRESS.regionalOffice}
      </p>
      <p style="margin: 0;">
        If you no longer wish to receive marketing announcements or promotional offers, you may 
        <a href="${unsubscribeUrl}" style="color: #007AFF; text-decoration: underline; font-weight: 600;" target="_blank" rel="noopener noreferrer">
          Unsubscribe Immediately
        </a> 
        or update your email preferences.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${businessName}
${subject}

${bodyContent.replace(/<[^>]+>/g, '')}

--------------------------------------------------
CAN-SPAM Statutory Compliance Notice:
Sender Physical Postal Address:
${physicalAddress}
${COMPANY_LEGAL_ADDRESS.regionalOffice}

To unsubscribe from future marketing emails, visit:
${unsubscribeUrl}
  `.trim();

  return { subject, html, text, unsubscribeUrl, physicalAddress };
}

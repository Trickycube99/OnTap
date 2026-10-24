/**
 * Accounting Export Utilities for Tally Prime and Zoho Books
 * PRD Phase 3: Accounting Software Integration
 */

/**
 * Generates and triggers download of Tally Prime XML Sales Vouchers
 */
export function exportToTallyPrimeXml(orders, theme) {
  const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  const voucherEntries = orders.map((order) => {
    const voucherNo = `POS-${order.id.replace('ORD-', '')}`;
    const voucherDate = currentDate;
    const narration = `QR Dine Order ${order.id} at ${order.table} - ${theme.restaurantName}`;
    const cgstAmount = order.tax ? (order.tax / 2).toFixed(2) : '0.00';
    const sgstAmount = order.tax ? (order.tax / 2).toFixed(2) : '0.00';
    const taxableSales = Number(order.subtotal || order.total || 0).toFixed(2);
    const totalAmount = Number(order.total || 0).toFixed(2);
    const ledgerName = (order.paymentMode || '').toLowerCase().includes('cash')
      ? 'Cash-in-Hand'
      : (order.paymentMode || '').toLowerCase().includes('card')
      ? 'HDFC POS Merchant Bank'
      : 'ICICI UPI BharatPe Current Account';

    return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="Sales" ACTION="Create">
        <DATE>${voucherDate}</DATE>
        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${voucherNo}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${ledgerName}</PARTYLEDGERNAME>
        <NARRATION>${narration}</NARRATION>
        
        <!-- Debit Party/Bank/Cash Ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${ledgerName}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${totalAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>

        <!-- Credit F&B Sales Taxable Ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Food & Beverage Sales (5% GST)</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${taxableSales}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>

        <!-- Credit Output CGST 2.5% -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output CGST @ 2.5%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${cgstAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>

        <!-- Credit Output SGST 2.5% -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output SGST @ 2.5%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${sgstAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>`;
  }).join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${theme.restaurantName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${voucherEntries}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tally_prime_sales_vouchers_${new Date().toISOString().slice(0, 10)}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and triggers download of Zoho Books CSV Invoice Import format
 */
export function exportToZohoBooksCsv(orders, _theme) {
  const headers = [
    'Invoice Number',
    'Customer Name',
    'Invoice Date',
    'Due Date',
    'Item Name',
    'Item Description',
    'Quantity',
    'Item Price (INR)',
    'Discount (INR)',
    'Tax Percentage',
    'CGST (2.5%)',
    'SGST (2.5%)',
    'Item Total (INR)',
    'Payment Mode',
    'Payment Status',
    'Table Reference'
  ];

  const rows = [];

  orders.forEach((order) => {
    const invNo = `INV-${order.id.replace('ORD-', '')}`;
    const dateStr = new Date(order.createdAt).toISOString().slice(0, 10);

    order.items.forEach((item) => {
      const itemSubtotal = item.price * item.quantity;
      const cgst = order.tax ? (itemSubtotal * 0.025).toFixed(2) : '0.00';
      const sgst = order.tax ? (itemSubtotal * 0.025).toFixed(2) : '0.00';
      const itemTotal = itemSubtotal.toFixed(2);

      rows.push([
        invNo,
        `"${order.customerName}"`,
        dateStr,
        dateStr,
        `"${item.name}"`,
        `"${item.note || 'Artisanal Fresh Dining'}"`,
        item.quantity,
        item.price.toFixed(0),
        0,
        '5%',
        cgst,
        sgst,
        itemTotal,
        `"${order.paymentMode}"`,
        `"${order.paymentStatus}"`,
        `"${order.table}"`
      ]);
    });
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zoho_books_invoices_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

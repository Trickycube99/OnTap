/**
 * Sales Verification Bridge & Reset Cycle Engine
 * - Real-time bridge between Counter Dashboard (Served Orders) and Owner Dashboard (Expected Orders)
 * - Daily sales reset at midnight (00:00:00) with archival to Daily Cash Check
 * - Weekly sales reset every Monday (00:00:00), adding all sales Monday through Sunday
 * - Monthly sales reset every 30th (00:00:00), adding all sales 30th through 29th
 * - On-demand CSV Export for Daily, Weekly, and Monthly data
 */

/**
 * Robust extractor for order creation date
 */
export function getOrderDate(order) {
  if (!order) return new Date();
  if (order.createdAt) {
    const d = new Date(order.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.timestamp) {
    const d = new Date(order.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof order.id === 'string' && order.id.toLowerCase().startsWith('ord-')) {
    const ts = parseInt(order.id.toLowerCase().replace('ord-', ''), 10);
    if (!isNaN(ts) && ts > 1000000000000) {
      return new Date(ts);
    }
  }
  return new Date();
}

/**
 * Daily Date Range: 00:00:00.000 to 23:59:59.999 (Midnight to Midnight)
 */
export function getDailyDateRange(refDate = new Date()) {
  const d = new Date(refDate);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/**
 * Weekly Date Range:
 * - Starts Monday 00:00:00.000
 * - Ends Sunday 23:59:59.999
 * - Resets on every Monday at midnight (00:00:00)
 */
export function getWeekDateRange(refDate = new Date()) {
  const now = new Date(refDate);
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // Monday is 0 days back, Sunday is 6 days back
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1); // Sunday 23:59:59.999
  
  // Next reset is coming Monday at 00:00:00
  const nextResetMonday = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  const msUntilReset = Math.max(0, nextResetMonday.getTime() - now.getTime());
  const daysUntilReset = Math.ceil(msUntilReset / (1000 * 60 * 60 * 24));

  return {
    startOfWeek,
    endOfWeek,
    nextResetMonday,
    daysUntilReset
  };
}

/**
 * Monthly Date Range (30th to 29th Cycle):
 * - Monthly sales resets on every 30th at 00:00:00
 * - Keeps adding all orders for the month from 30th until 29th of the next month
 * - Handles February / short months gracefully
 */
export function get30thMonthDateRange(refDate = new Date()) {
  const now = new Date(refDate);
  const dayOfMonth = now.getDate();
  let startYear = now.getFullYear();
  let startMonth = now.getMonth();

  if (dayOfMonth >= 30) {
    // Current cycle started on 30th of this month
  } else {
    // Current cycle started on 30th of previous month
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  // Handle month length for starting month (e.g., February has 28 or 29 days)
  const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
  const actualStartDay = Math.min(30, daysInStartMonth);
  const startOfCycle = new Date(startYear, startMonth, actualStartDay, 0, 0, 0, 0);

  // Next reset occurs on the 30th of the next month
  let nextResetMonth = startMonth + 1;
  let nextResetYear = startYear;
  if (nextResetMonth > 11) {
    nextResetMonth = 0;
    nextResetYear += 1;
  }
  const daysInNextMonth = new Date(nextResetYear, nextResetMonth + 1, 0).getDate();
  const actualNextResetDay = Math.min(30, daysInNextMonth);
  const nextResetDate = new Date(nextResetYear, nextResetMonth, actualNextResetDay, 0, 0, 0, 0);
  const endOfCycle = new Date(nextResetDate.getTime() - 1); // 23:59:59.999 just before reset

  const msUntilReset = Math.max(0, nextResetDate.getTime() - now.getTime());
  const daysUntilReset = Math.ceil(msUntilReset / (1000 * 60 * 60 * 24));

  // Formatted cycle label (e.g. "30 Sep - 29 Oct 2026")
  const startStr = startOfCycle.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const endStr = endOfCycle.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const cycleLabel = `${startStr} - ${endStr}`;

  return {
    startOfCycle,
    endOfCycle,
    nextResetDate,
    daysUntilReset,
    cycleLabel
  };
}

/**
 * Filter valid non-rejected, non-cancelled orders
 */
export function getValidOrders(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.filter((o) => o && o.status !== 'rejected' && o.status !== 'cancelled');
}

/**
 * Calculate Real-Time Verification Bridge between Counter Served Orders and Owner Expected Orders
 */
export function calculateVerificationBridge({ orders, refDate = new Date(), latestEodReport = null }) {
  const validOrders = getValidOrders(orders);
  const { start: todayStart, end: todayEnd } = getDailyDateRange(refDate);

  // Today's valid recorded orders
  const todayOrders = validOrders.filter((o) => {
    const d = getOrderDate(o);
    return d >= todayStart && d <= todayEnd;
  });

  // Served Orders: strictly orders marked as 'served' or 'done' by Counter POS
  const servedOrders = todayOrders.filter((o) => o.status === 'served' || o.status === 'done');

  // In-Kitchen / Pending Orders: orders still received, cooking, in-progress, or ready
  const inPrepOrders = todayOrders.filter((o) => o.status !== 'served' && o.status !== 'done');

  // Amounts
  const totalServedAmount = servedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalExpectedAmount = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const unservedAmount = Math.max(0, totalExpectedAmount - totalServedAmount);

  // Counts
  const servedCount = servedOrders.length;
  const expectedCount = todayOrders.length;
  const unservedCount = inPrepOrders.length;

  // Channel Splits - Served
  const servedCash = servedOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('cash') || (o.paymentMode || '').toLowerCase().includes('counter'))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const servedCard = servedOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('card'))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const servedUpi = servedOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('upi'))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  // Channel Splits - Expected (Total Placed)
  const expectedCash = todayOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('cash') || (o.paymentMode || '').toLowerCase().includes('counter'))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const expectedCard = todayOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('card'))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const expectedUpi = todayOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('upi'))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  // Fulfillment Rate
  const fulfillmentRate = expectedCount > 0
    ? Math.min(100, (totalServedAmount / (totalExpectedAmount || 1)) * 100)
    : 100;
  const isFullyServed = expectedCount > 0 && unservedCount === 0;

  // Verification status indicator
  let statusTone = 'empty';
  let statusTitle = 'No Orders Placed Yet Today';
  let statusSubtitle = 'Waiting for table QR orders or counter walk-ins';

  if (expectedCount > 0) {
    if (isFullyServed) {
      statusTone = 'verified';
      statusTitle = '100% Verified & Balanced';
      statusSubtitle = `All ${expectedCount} placed orders have been successfully served to diners`;
    } else {
      statusTone = 'in-prep';
      statusTitle = `${unservedCount} In Kitchen (${fulfillmentRate.toFixed(0)}% Served)`;
      statusSubtitle = `₹${unservedAmount.toFixed(0)} remaining to be served to tables`;
    }
  }

  // EOD Cash Checklist reconciliation bridge
  const hasEodSubmitted = Boolean(latestEodReport);
  const filledActualRevenue = latestEodReport?.actual?.total ?? null;
  const eodVariance = latestEodReport?.variance ?? (hasEodSubmitted && filledActualRevenue !== null ? filledActualRevenue - totalExpectedAmount : 0);

  return {
    todayOrders,
    servedOrders,
    inPrepOrders,
    totalServedAmount,
    totalExpectedAmount,
    unservedAmount,
    servedCount,
    expectedCount,
    unservedCount,
    fulfillmentRate,
    isFullyServed,
    statusTone,
    statusTitle,
    statusSubtitle,
    channels: {
      served: { cash: servedCash, card: servedCard, upi: servedUpi, total: totalServedAmount },
      expected: { cash: expectedCash, card: expectedCard, upi: expectedUpi, total: totalExpectedAmount },
      unserved: {
        cash: Math.max(0, expectedCash - servedCash),
        card: Math.max(0, expectedCard - servedCard),
        upi: Math.max(0, expectedUpi - servedUpi),
        total: unservedAmount
      }
    },
    eod: {
      hasEodSubmitted,
      filledActualRevenue,
      eodVariance,
      latestEodReport
    },
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}

/**
 * Build Historical Daily Records for the Daily Cash Check Section
 * Automatically combines manual EOD checklists + historical days from orders
 */
export function buildDailyArchives({ orders, checklists = [] }) {
  const validOrders = getValidOrders(orders);
  const checklistMap = new Map();
  (checklists || []).forEach((c) => {
    if (c && c.date) {
      checklistMap.set(c.date, c);
    }
  });

  // Group orders by date string YYYY-MM-DD
  const daysMap = new Map();
  validOrders.forEach((o) => {
    const d = getOrderDate(o);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const displayDate = d.toLocaleDateString('en-IN');
    if (!daysMap.has(dateKey)) {
      daysMap.set(dateKey, { dateKey, displayDate, dateObj: d, orders: [] });
    }
    daysMap.get(dateKey).orders.push(o);
  });

  // Also include any checklists that might not have orders in memory
  (checklists || []).forEach((c) => {
    if (c && c.date) {
      let foundKey = null;
      for (const [k, v] of daysMap.entries()) {
        if (v.displayDate === c.date || k === c.date) {
          foundKey = k;
          break;
        }
      }
      if (!foundKey) {
        const d = c.createdAt ? new Date(c.createdAt) : new Date();
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        daysMap.set(dateKey, { dateKey, displayDate: c.date, dateObj: d, orders: [] });
      }
    }
  });

  // Convert to sorted list (most recent first)
  const todayStr = new Date().toLocaleDateString('en-IN');
  const dailyRecords = Array.from(daysMap.values())
    .map(({ dateKey, displayDate, dateObj, orders: dayOrders }) => {
      const isToday = displayDate === todayStr;
      const checklist = checklistMap.get(displayDate) || null;

      const servedOrders = dayOrders.filter((o) => o.status === 'served' || o.status === 'done');
      const inPrepOrders = dayOrders.filter((o) => o.status !== 'served' && o.status !== 'done');
      const expectedTotal = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const servedTotal = servedOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const unservedTotal = Math.max(0, expectedTotal - servedTotal);

      const cashSplit = dayOrders
        .filter((o) => (o.paymentMode || '').toLowerCase().includes('cash') || (o.paymentMode || '').toLowerCase().includes('counter'))
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
      const cardSplit = dayOrders
        .filter((o) => (o.paymentMode || '').toLowerCase().includes('card'))
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
      const upiSplit = dayOrders
        .filter((o) => (o.paymentMode || '').toLowerCase().includes('upi'))
        .reduce((s, o) => s + (Number(o.total) || 0), 0);

      const filledTotal = checklist?.actual?.total ?? (isToday ? null : expectedTotal);
      const filledCash = checklist?.actual?.cash ?? (isToday ? null : cashSplit);
      const filledCard = checklist?.actual?.card ?? (isToday ? null : cardSplit);
      const filledUpi = checklist?.actual?.upi ?? (isToday ? null : upiSplit);
      const variance = checklist ? (checklist.variance ?? (filledTotal - expectedTotal)) : 0;

      let status = 'Archived at Midnight';
      if (checklist) {
        status = checklist.status || 'Audited & Submitted';
      } else if (isToday) {
        status = inPrepOrders.length === 0 && dayOrders.length > 0 ? 'Live (All Dishes Served)' : 'Live Stack Active';
      }

      return {
        id: checklist?.id || `DAY-${dateKey}`,
        dateKey,
        date: displayDate,
        dateObj,
        isToday,
        dayOfWeek: dateObj.toLocaleDateString('en-IN', { weekday: 'short' }),
        timestamp: checklist?.timestamp || (isToday ? 'Live Sync' : '23:59:59'),
        orderCount: dayOrders.length,
        servedCount: servedOrders.length,
        inPrepCount: inPrepOrders.length,
        expectedTotal,
        servedTotal,
        unservedTotal,
        cashSplit,
        cardSplit,
        upiSplit,
        filledTotal,
        filledCash,
        filledCard,
        filledUpi,
        actual: {
          cash: filledCash !== null ? filledCash : cashSplit,
          card: filledCard !== null ? filledCard : cardSplit,
          upi: filledUpi !== null ? filledUpi : upiSplit,
          total: filledTotal !== null ? filledTotal : expectedTotal
        },
        expected: {
          cash: cashSplit,
          card: cardSplit,
          upi: upiSplit,
          total: expectedTotal
        },
        variance,
        status,
        submittedBy: checklist?.submittedBy || (isToday ? 'Live System' : 'Auto Midnight Audit'),
        staffRole: checklist?.staffRole || (isToday ? 'Counter POS' : 'Midnight Reconciliation Engine'),
        varianceReason: checklist?.varianceReason || (variance === 0 ? 'Balanced settlement verified' : 'Audited settlement')
      };
    })
    .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  return dailyRecords;
}

/**
 * Build Weekly Archives for Profit & Expense Section
 * Cycles: Monday 00:00:00 to Sunday 23:59:59 (Resetting every Monday)
 */
export function buildWeeklyArchives({ orders, expenses = [] }) {
  const validOrders = getValidOrders(orders);
  const now = new Date();
  const { startOfWeek: currentWeekStart, endOfWeek: currentWeekEnd } = getWeekDateRange(now);

  // Group orders by week key (Monday timestamp)
  const weeksMap = new Map();

  const getWeekKey = (date) => {
    const { startOfWeek, endOfWeek } = getWeekDateRange(date);
    const key = startOfWeek.toISOString().slice(0, 10);
    return { key, startOfWeek, endOfWeek };
  };

  // Ensure current active week is always present
  const currentWeekKey = currentWeekStart.toISOString().slice(0, 10);
  weeksMap.set(currentWeekKey, {
    key: currentWeekKey,
    startOfWeek: currentWeekStart,
    endOfWeek: currentWeekEnd,
    isCurrent: true,
    orders: [],
    expenses: []
  });

  validOrders.forEach((o) => {
    const d = getOrderDate(o);
    const { key, startOfWeek, endOfWeek } = getWeekKey(d);
    if (!weeksMap.has(key)) {
      weeksMap.set(key, {
        key,
        startOfWeek,
        endOfWeek,
        isCurrent: key === currentWeekKey,
        orders: [],
        expenses: []
      });
    }
    weeksMap.get(key).orders.push(o);
  });

  (expenses || []).forEach((exp) => {
    const expDate = exp.date ? new Date(exp.date) : (exp.createdAt ? new Date(exp.createdAt) : now);
    const validExpDate = !isNaN(expDate.getTime()) ? expDate : now;
    const { key } = getWeekKey(validExpDate);
    if (weeksMap.has(key)) {
      weeksMap.get(key).expenses.push(exp);
    }
  });

  return Array.from(weeksMap.values())
    .map((w) => {
      const grossSales = w.orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const servedSales = w.orders
        .filter((o) => o.status === 'served' || o.status === 'done')
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
      const totalExpenses = w.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const netProfit = grossSales - totalExpenses;

      const startLabel = w.startOfWeek.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const endLabel = w.endOfWeek.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const weekLabel = `${startLabel} - ${endLabel}`;

      return {
        key: w.key,
        weekLabel,
        startOfWeek: w.startOfWeek,
        endOfWeek: w.endOfWeek,
        isCurrent: w.isCurrent,
        orderCount: w.orders.length,
        grossSales,
        servedSales,
        totalExpenses,
        netProfit,
        status: w.isCurrent ? 'Active (Adding till Monday)' : 'Archived & Settled'
      };
    })
    .sort((a, b) => b.startOfWeek.getTime() - a.startOfWeek.getTime());
}

/**
 * Build Monthly Archives for Profit & Expense Section
 * Cycles: 30th to 29th of each month (Resetting every 30th)
 */
export function buildMonthlyArchives({ orders, expenses = [] }) {
  const validOrders = getValidOrders(orders);
  const now = new Date();
  const { startOfCycle: currentCycleStart, endOfCycle: currentCycleEnd } = get30thMonthDateRange(now);

  const monthsMap = new Map();

  const getMonthKey = (date) => {
    const { startOfCycle, endOfCycle, cycleLabel } = get30thMonthDateRange(date);
    const key = startOfCycle.toISOString().slice(0, 10);
    return { key, startOfCycle, endOfCycle, cycleLabel };
  };

  const currentMonthKey = currentCycleStart.toISOString().slice(0, 10);
  monthsMap.set(currentMonthKey, {
    key: currentMonthKey,
    startOfCycle: currentCycleStart,
    endOfCycle: currentCycleEnd,
    cycleLabel: get30thMonthDateRange(now).cycleLabel,
    isCurrent: true,
    orders: [],
    expenses: []
  });

  validOrders.forEach((o) => {
    const d = getOrderDate(o);
    const { key, startOfCycle, endOfCycle, cycleLabel } = getMonthKey(d);
    if (!monthsMap.has(key)) {
      monthsMap.set(key, {
        key,
        startOfCycle,
        endOfCycle,
        cycleLabel,
        isCurrent: key === currentMonthKey,
        orders: [],
        expenses: []
      });
    }
    monthsMap.get(key).orders.push(o);
  });

  (expenses || []).forEach((exp) => {
    const expDate = exp.date ? new Date(exp.date) : (exp.createdAt ? new Date(exp.createdAt) : now);
    const validExpDate = !isNaN(expDate.getTime()) ? expDate : now;
    const { key } = getMonthKey(validExpDate);
    if (monthsMap.has(key)) {
      monthsMap.get(key).expenses.push(exp);
    }
  });

  return Array.from(monthsMap.values())
    .map((m) => {
      const grossSales = m.orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const servedSales = m.orders
        .filter((o) => o.status === 'served' || o.status === 'done')
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
      const totalExpenses = m.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const netProfit = grossSales - totalExpenses;

      return {
        key: m.key,
        monthLabel: m.cycleLabel,
        startOfCycle: m.startOfCycle,
        endOfCycle: m.endOfCycle,
        isCurrent: m.isCurrent,
        orderCount: m.orders.length,
        grossSales,
        servedSales,
        totalExpenses,
        netProfit,
        status: m.isCurrent ? 'Active (Adding till 30th)' : 'Archived & Settled'
      };
    })
    .sort((a, b) => b.startOfCycle.getTime() - a.startOfCycle.getTime());
}

/**
 * Export Daily Data to CSV
 */
export function exportDailyDataCsv(dailyRecords, restaurantName = 'Restaurant') {
  const headers = [
    'Date',
    'Day',
    'Total Expected Orders (INR)',
    'Total Served Orders (INR)',
    'In-Kitchen Unserved (INR)',
    'Order Count',
    'Served Count',
    'Actual Cash Counted (INR)',
    'Expected Cash (INR)',
    'Actual Card Settled (INR)',
    'Expected Card (INR)',
    'Actual UPI Settled (INR)',
    'Expected UPI (INR)',
    'Total Filled Revenue (INR)',
    'Closing Variance (INR)',
    'Settlement Status',
    'Audited By',
    'Staff Role',
    'Audit Note'
  ];

  const rows = dailyRecords.map((r) => [
    `"${r.date}"`,
    `"${r.dayOfWeek}"`,
    r.expectedTotal.toFixed(0),
    r.servedTotal.toFixed(0),
    r.unservedTotal.toFixed(0),
    r.orderCount,
    r.servedCount,
    r.filledCash !== null ? r.filledCash.toFixed(0) : 'Pending',
    r.cashSplit.toFixed(0),
    r.filledCard !== null ? r.filledCard.toFixed(0) : 'Pending',
    r.cardSplit.toFixed(0),
    r.filledUpi !== null ? r.filledUpi.toFixed(0) : 'Pending',
    r.upiSplit.toFixed(0),
    r.filledTotal !== null ? r.filledTotal.toFixed(0) : 'Pending',
    r.variance !== null ? r.variance.toFixed(0) : 0,
    `"${r.status}"`,
    `"${r.submittedBy}"`,
    `"${r.staffRole}"`,
    `"${r.varianceReason || ''}"`
  ]);

  triggerCsvDownload(headers, rows, `${restaurantName.replace(/\s+/g, '_')}_daily_cash_check_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export Weekly Sales & P&L to CSV
 */
export function exportWeeklyDataCsv(weeklyRecords, restaurantName = 'Restaurant') {
  const headers = [
    'Weekly Cycle (Monday - Sunday)',
    'Cycle Start Date',
    'Cycle End Date',
    'Total Orders Placed',
    'Gross Weekly Sales (INR)',
    'Total Served Amount (INR)',
    'Total Recorded Expenses (INR)',
    'Net Weekly Profit (INR)',
    'Cycle Status'
  ];

  const rows = weeklyRecords.map((w) => [
    `"${w.weekLabel}"`,
    `"${w.startOfWeek.toISOString().slice(0, 10)}"`,
    `"${w.endOfWeek.toISOString().slice(0, 10)}"`,
    w.orderCount,
    w.grossSales.toFixed(0),
    w.servedSales.toFixed(0),
    w.totalExpenses.toFixed(0),
    w.netProfit.toFixed(0),
    `"${w.status}"`
  ]);

  triggerCsvDownload(headers, rows, `${restaurantName.replace(/\s+/g, '_')}_weekly_sales_pnl_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export Monthly Sales & P&L to CSV
 */
export function exportMonthlyDataCsv(monthlyRecords, restaurantName = 'Restaurant') {
  const headers = [
    'Monthly Cycle (30th - 29th)',
    'Cycle Start Date',
    'Cycle End Date',
    'Total Orders Placed',
    'Gross Monthly Sales (INR)',
    'Total Served Amount (INR)',
    'Total Recorded Expenses (INR)',
    'Net Monthly Profit (INR)',
    'Cycle Status'
  ];

  const rows = monthlyRecords.map((m) => [
    `"${m.monthLabel}"`,
    `"${m.startOfCycle.toISOString().slice(0, 10)}"`,
    `"${m.endOfCycle.toISOString().slice(0, 10)}"`,
    m.orderCount,
    m.grossSales.toFixed(0),
    m.servedSales.toFixed(0),
    m.totalExpenses.toFixed(0),
    m.netProfit.toFixed(0),
    `"${m.status}"`
  ]);

  triggerCsvDownload(headers, rows, `${restaurantName.replace(/\s+/g, '_')}_monthly_sales_pnl_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Helper to trigger browser CSV download
 */
function triggerCsvDownload(headers, rows, fileName) {
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

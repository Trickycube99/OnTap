import React, { useState } from 'react';
import { MessageSquare, X, CheckCheck } from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function WhatsAppAlertModal({ order, orders = [], expenses = [], theme, chef, onClose }) {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'owner'

  // Calculate live daily numbers from real-time database
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysOrders = (orders || []).filter((o) => {
    if (!o) return false;
    const dateStr = (o.createdAt || o.timestamp || '').slice(0, 10);
    return (!dateStr || dateStr === todayStr) && o.status !== 'rejected' && o.status !== 'cancelled';
  });

  const totalSales = todaysOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const cashSales = todaysOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('cash') || (o.paymentMode || '').toLowerCase().includes('counter'))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const upiSales = todaysOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('upi'))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const cardSales = todaysOrders
    .filter((o) => (o.paymentMode || '').toLowerCase().includes('card'))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const todaysExpenses = (expenses || []).filter((e) => {
    if (!e) return false;
    const d = (e.date || '').slice(0, 10);
    return !d || d === todayStr;
  });
  const totalExpenses = todaysExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = totalSales - totalExpenses;

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: `${theme?.restaurantName || 'Restaurant'} Kitchen`,
      time: 'Just now',
      text: `*Namaste ${order?.customerName || 'Guest'}!* 🙏\n\nYour order *#${order?.id || 'ORD-NEW'}* from *${theme?.restaurantName || 'Restaurant'}* has been received by our kitchen team.\n\n🍽️ *Table:* ${order?.table || 'Table 01'}\n💰 *Total:* ₹${Number(order?.total || 0).toLocaleString('en-IN')}\n⚡ *Status:* Cooking in Kitchen\n\nTrack your order in real time.`,
      status: 'read'
    }
  ]);

  const handleSendUpdate = (statusText) => {
    playTapSound();
    const newMsg = {
      id: Date.now(),
      sender: `${theme?.restaurantName || 'Restaurant'} Kitchen`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `*Order Update #${order?.id || 'NEW'}* 🔔\n\n${statusText}\n\nFreshly prepared with top hygiene and care. Thank you!`,
      status: 'read'
    };
    setMessages((prev) => [...prev, newMsg]);
    playSuccessChime();
  };

  const handleSendOwnerSummary = () => {
    playTapSound();
    const ownerMsg = {
      id: Date.now(),
      sender: 'Store Manager Bot',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `📊 *Today's Sales & Cash Summary*\n\n📅 Date: ${new Date().toLocaleDateString('en-IN')}\n\n💰 *Total Sales:* ₹${totalSales.toLocaleString('en-IN')} (${todaysOrders.length} order${todaysOrders.length === 1 ? '' : 's'})\n💵 *Cash:* ₹${cashSales.toLocaleString('en-IN')}\n⚡ *UPI:* ₹${upiSales.toLocaleString('en-IN')}\n💳 *Card:* ₹${cardSales.toLocaleString('en-IN')}\n\n📉 *Today's Expenses:* ₹${totalExpenses.toLocaleString('en-IN')}\n📈 *Net Profit:* ₹${netProfit.toLocaleString('en-IN')}`,
      status: 'read'
    };
    setMessages((prev) => [...prev, ownerMsg]);
    playSuccessChime();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, background: '#ECE5DD', padding: 0, overflow: 'hidden' }}
      >
        {/* WhatsApp Top Header Bar */}
        <div style={{ background: '#075E54', color: '#FFFFFF', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              <MessageSquare size={18} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{theme.restaurantName} WhatsApp</div>
              <div style={{ fontSize: 10, color: '#D1E7DD' }}>Official Store Account • Online</div>
            </div>
          </div>
          <button style={{ border: 'none', background: 'transparent', color: '#FFFFFF', cursor: 'pointer' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher: Diner Alert vs Owner Summary */}
        <div style={{ display: 'flex', background: '#128C7E', padding: '4px 10px' }}>
          <button
            type="button"
            className="capsule-tab"
            style={{
              flex: 1,
              background: activeTab === 'customer' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 600
            }}
            onClick={() => setActiveTab('customer')}
          >
            Customer Alerts
          </button>
          <button
            type="button"
            className="capsule-tab"
            style={{
              flex: 1,
              background: activeTab === 'owner' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 600
            }}
            onClick={() => setActiveTab('owner')}
          >
            Owner Daily Summary
          </button>
        </div>

        {/* Chat Message Bubble Area */}
        <div style={{ padding: '16px 14px', minHeight: 300, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: 'flex-start',
                background: '#FFFFFF',
                borderRadius: '8px 8px 8px 0',
                padding: '10px 12px',
                maxWidth: '90%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#111827',
                whiteSpace: 'pre-line'
              }}
            >
              <div>{msg.text}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: '#6B7280' }}>
                <span>{msg.time}</span>
                <CheckCheck size={14} color="#34B7F1" />
              </div>
            </div>
          ))}
        </div>

        {/* Quick Send Action Buttons */}
        <div style={{ background: '#F0F2F5', padding: '12px 14px', borderTop: '1px solid #D1D5DB' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', marginBottom: 6 }}>
            {activeTab === 'customer' ? 'Send Customer Message:' : 'Send Daily Sales to Owner:'}
          </div>

          {activeTab === 'customer' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary-pill"
                style={{ flex: 1, padding: '7px 8px', fontSize: 11, background: '#FFFFFF' }}
                onClick={() => handleSendUpdate(`Your hot food is Ready to Serve at ${order?.table || 'your table'}!`)}
              >
                Send "Order Ready"
              </button>
              <button
                className="btn-secondary-pill"
                style={{ flex: 1, padding: '7px 8px', fontSize: 11, background: '#FFFFFF' }}
                onClick={() => handleSendUpdate('Thank you for dining with us! Hope you enjoyed the food.')}
              >
                Ask for Rating
              </button>
            </div>
          ) : (
            <button
              className="btn-primary-pill full-width"
              style={{ background: '#128C7E', fontSize: 12, padding: '8px 12px' }}
              onClick={handleSendOwnerSummary}
            >
              Send Today's Sales & Cash Report to Owner WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

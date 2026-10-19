import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  RefreshCw,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function MultiBranchView({ theme: _theme, chef: _chef }) {
  const [selectedBranchId, setSelectedBranchId] = useState('all'); // 'all' | 'delhi' | 'gurugram' | 'bengaluru'
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const branches = [
    {
      id: 'delhi',
      name: 'Connaught Place (Flagship)',
      city: 'New Delhi',
      address: 'Block M, Inner Circle, Connaught Place, New Delhi - 110001',
      headChef: 'Executive Chef Rakesh Sharma (FSSAI Verified)',
      todaySales: 38450,
      activeOrders: 6,
      tableOccupancy: '82%',
      avgPrepTime: '11 mins',
      staffOnDuty: 8,
      status: 'Open & Busy'
    },
    {
      id: 'gurugram',
      name: 'DLF Cyber Hub',
      city: 'Gurugram',
      address: 'Building 10, Ground Floor, DLF Cyber Hub, Gurugram - 122002',
      headChef: 'Sous Chef Amit Rawat',
      todaySales: 29800,
      activeOrders: 4,
      tableOccupancy: '68%',
      avgPrepTime: '9 mins',
      staffOnDuty: 6,
      status: 'Open'
    },
    {
      id: 'bengaluru',
      name: '12th Main Indiranagar',
      city: 'Bengaluru',
      address: '744, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru - 560038',
      headChef: 'Chef de Cuisine Priya Menon',
      todaySales: 31200,
      activeOrders: 5,
      tableOccupancy: '75%',
      avgPrepTime: '12 mins',
      staffOnDuty: 7,
      status: 'Open'
    }
  ];

  const handleSyncMenuNetwork = () => {
    playTapSound();
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncDone(true);
      playSuccessChime();
    }, 1200);
  };

  const totalNetworkSales = branches.reduce((s, b) => s + b.todaySales, 0);
  const totalActiveOrders = branches.reduce((s, b) => s + b.activeOrders, 0);
  const totalStaffCount = branches.reduce((s, b) => s + b.staffOnDuty, 0);

  const activeBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">All Restaurant Branches</div>
        <div className="screen-subtitle">View today's sales and staff across all your restaurant locations</div>
      </div>

      {/* Network KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Sales (All Branches)</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            ₹{totalNetworkSales.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: '#16A34A' }}>3 Branches Open</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tables Dining Now</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginTop: 2 }}>
            {totalActiveOrders} Tables Dining
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>75% Tables Full</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Staff on Duty</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
            {totalStaffCount} Staff Active
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Across NCR & BLR</div>
        </div>
      </div>

      {/* Central Sync Banner */}
      <div
        className="ios-card active-gradient"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          padding: '12px 14px'
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="#007AFF" />
            <span>Copy Menu & Prices to All Branches</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Update prices and dishes in all 3 branches with one click
          </div>
        </div>

        <button
          className="btn-primary-pill"
          style={{ fontSize: 12, padding: '7px 14px' }}
          onClick={handleSyncMenuNetwork}
          disabled={isSyncing}
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Updating All...' : 'Update All Branches'}</span>
        </button>
      </div>

      {syncDone && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            background: '#DCFCE7',
            border: '1px solid #86EFAC',
            borderRadius: 12,
            fontSize: 12,
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <CheckCircle2 size={16} />
          <span>Menu items and prices have been updated in Connaught Place, Cyber Hub, and Indiranagar.</span>
        </div>
      )}

      {/* Branch Selector Tabs */}
      <div className="filter-tabs-container" style={{ padding: '0 0 12px' }}>
        <button
          className={`capsule-tab ${selectedBranchId === 'all' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setSelectedBranchId('all');
          }}
        >
          All 3 Branches
        </button>
        {branches.map((b) => (
          <button
            key={b.id}
            className={`capsule-tab ${selectedBranchId === b.id ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setSelectedBranchId(b.id);
            }}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Branches List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(selectedBranchId === 'all' ? branches : [activeBranch]).map((branch) => (
          <div key={branch.id} className="ios-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={16} color="#007AFF" />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{branch.name}</span>
                  <span className="status-pill done" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {branch.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <MapPin size={12} />
                  <span>{branch.address}</span>
                </div>
                <div style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>
                  👨‍🍳 Head Chef: <strong>{branch.headChef}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Today Sales</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-blue)' }}>
                  ₹{branch.todaySales.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Branch Performance Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                marginTop: 12,
                background: '#F9FAFB',
                padding: '10px 8px',
                borderRadius: 12,
                textAlign: 'center',
                fontSize: 11
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Occupancy</div>
                <div style={{ fontWeight: 700 }}>{branch.tableOccupancy}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Active Tables</div>
                <div style={{ fontWeight: 700 }}>{branch.activeOrders}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Kitchen Speed</div>
                <div style={{ fontWeight: 700 }}>{branch.avgPrepTime}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Staff Present</div>
                <div style={{ fontWeight: 700 }}>{branch.staffOnDuty} staff</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

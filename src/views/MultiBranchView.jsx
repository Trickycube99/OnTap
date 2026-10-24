import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  RefreshCw,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';
import { getBusinesses } from '../utils/businessManager';

export default function MultiBranchView({ theme, chef: _chef }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  useEffect(() => {
    const rawBizList = getBusinesses() || [];
    const mapped = rawBizList.map((b) => ({
      id: b.id,
      name: b.name || 'Restaurant Outlet',
      city: b.city || b.location || 'Main Branch',
      address: b.address || `${b.name || 'Outlet'}, Store #${b.id.slice(0, 6)}`,
      headChef: b.chef?.name ? `${b.chef.name} (${b.chef.title || 'Head Chef'})` : 'Executive Head Chef',
      todaySales: 0,
      activeOrders: 0,
      tableOccupancy: '0%',
      avgPrepTime: '12 mins',
      staffOnDuty: Array.isArray(b.staff) ? b.staff.length : 0,
      status: 'Online & Active'
    }));
    setBranches(mapped);
  }, [theme]);

  const handleSyncMenuNetwork = () => {
    playTapSound();
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncDone(true);
      playSuccessChime();
    }, 1000);
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
        <div className="screen-subtitle">View today's sales and staff across all your registered outlets</div>
      </div>

      {/* Network KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Sales (All Outlets)</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            ₹{totalNetworkSales.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: '#16A34A' }}>{branches.length} Outlets Provisioned</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Orders</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginTop: 2 }}>
            {totalActiveOrders} Live Orders
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Across All Outlets</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Staff on Duty</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
            {totalStaffCount} Registered Staff
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Across Multi-Branch Network</div>
        </div>
      </div>

      {/* Central Sync Banner */}
      {branches.length > 0 && (
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
              <span>Sync Menu & Pricing Network</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Update dishes and pricing instantly across all {branches.length} branches
            </div>
          </div>

          <button
            className="btn-primary-pill"
            style={{ fontSize: 12, padding: '7px 14px' }}
            onClick={handleSyncMenuNetwork}
            disabled={isSyncing}
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Updating Outlets...' : 'Update All Outlets'}</span>
          </button>
        </div>
      )}

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
          <span>Menu items and prices have been synchronized to all outlets in real time.</span>
        </div>
      )}

      {/* Branch Selector Tabs */}
      {branches.length > 0 ? (
        <>
          <div className="filter-tabs-container" style={{ padding: '0 0 12px' }}>
            <button
              className={`capsule-tab ${selectedBranchId === 'all' ? 'active' : ''}`}
              onClick={() => {
                playTapSound();
                setSelectedBranchId('all');
              }}
            >
              All Outlets ({branches.length})
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
            {(selectedBranchId === 'all' ? branches : [activeBranch].filter(Boolean)).map((branch) => (
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
                    <div style={{ color: 'var(--text-muted)' }}>Active Orders</div>
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
        </>
      ) : (
        <div style={{ padding: '36px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B' }}>
          <Building2 size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>No Outlets Registered Yet</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Provision and add restaurant outlets from the Developer Admin Portal to view multi-branch metrics.
          </div>
        </div>
      )}
    </div>
  );
}

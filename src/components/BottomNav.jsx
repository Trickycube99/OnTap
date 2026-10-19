import React from 'react';
import {
  Utensils,
  ShieldCheck,
  ShoppingBag,
  Clock,
  Layers,
  PlusCircle,
  SlidersHorizontal,
  CheckSquare,
  BarChart3,
  Receipt,
  DollarSign,
  Users,
  Tag
} from 'lucide-react';
import { playTapSound } from '../utils/audio';
import { isAuthenticated } from '../utils/auth';

export default function BottomNav({
  currentRole,
  activeTab,
  setActiveTab,
  cartCount,
  activeOrdersCount,
  language = 'en',
  authSessions: _authSessions = {},
  theme = null,
  chef = null,
  showAboutChef = true
}) {
  if (currentRole === 'developer' || !isAuthenticated(currentRole)) {
    return null;
  }

  const isChefVisible = showAboutChef !== false && chef?.showAboutChef !== false && theme?.showAboutChef !== false;

  const getTabs = () => {
    if (currentRole === 'customer' || currentRole === 'chef') {
      const tabs = [
        {
          id: 'menu',
          label: language === 'hi' ? 'मेनू' : 'Menu',
          icon: Utensils
        },
        {
          id: 'cart',
          label: language === 'hi' ? 'थाली' : 'Tray',
          icon: ShoppingBag,
          badge: cartCount > 0 ? cartCount : null
        },
        {
          id: 'track',
          label: language === 'hi' ? 'लाइव स्थिति' : 'Live Status',
          icon: Clock,
          badge: activeOrdersCount > 0 ? activeOrdersCount : null
        }
      ];

      if (isChefVisible) {
        tabs.push({
          id: 'chef',
          label: language === 'hi' ? 'शेफ स्टोरी' : 'Chef & Story',
          icon: ShieldCheck,
          hasDot: true
        });
      }

      return tabs;
    } else if (currentRole === 'counter') {
      return [
        { id: 'orders', label: 'Kitchen Orders', icon: Layers, badge: activeOrdersCount > 0 ? activeOrdersCount : null },
        { id: 'manual', label: 'New Order', icon: PlusCircle },
        { id: 'stock', label: 'Items & Rates', icon: SlidersHorizontal },
        { id: 'checklist', label: 'Daily Cash', icon: CheckSquare }
      ];
    } else {
      // Owner Admin
      return [
        { id: 'sales', label: 'Sales', icon: BarChart3 },
        { id: 'orders', label: 'Bills', icon: Receipt },
        { id: 'offers', label: 'Discounts', icon: Tag },
        { id: 'pnl', label: 'Profit & Cash', icon: DollarSign },
        { id: 'payroll', label: 'Salaries', icon: Users }
      ];
    }
  };

  const tabs = getTabs();

  return (
    <nav className="ios-bottom-nav">
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            className={`bottom-tab-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setActiveTab(tab.id);
            }}
          >
            <div className="tab-icon-wrapper">
              <IconComponent size={21} strokeWidth={isActive ? 2.5 : 1.8} />
              {tab.badge && <span className="badge-count">{tab.badge}</span>}
              {tab.hasDot && !tab.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -1,
                    right: -2,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10B981'
                  }}
                />
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

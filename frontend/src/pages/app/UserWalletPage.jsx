import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { walletsApi } from '../../api/walletsApi';

export default function UserWalletPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0, welcomeBonusCredited: false });
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({ enabled: true, welcomeBonusAmount: 100, walletDiscountPercentage: 20 });
  const [error, setError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const [walletRes, txRes, settingsRes] = await Promise.all([
        walletsApi.getMyUserWallet().catch(() => ({ success: false })),
        walletsApi.getMyUserTransactions({ limit: 30 }).catch(() => ({ success: false })),
        walletsApi.getPublicWalletSettings().catch(() => ({ success: false }))
      ]);

      if (walletRes?.success && walletRes?.data) {
        setWallet(walletRes.data);
      }
      if (txRes?.success && txRes?.data) {
        setTransactions(txRes.data.transactions || []);
      }
      if (settingsRes?.success && settingsRes?.data) {
        setSettings(settingsRes.data);
      }
    } catch (err) {
      console.error('Failed to load wallet data:', err);
      setError('Could not load wallet details. Please pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getContextLabel = (tx) => {
    switch (tx.context) {
      case 'WELCOME_BONUS':
        return { label: '🎉 Welcome Bonus', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
      case 'SERVICE_DISCOUNT':
        return { label: '🏷️ Booking Discount', color: 'bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300' };
      case 'REFUND':
        return { label: '↩️ Booking Refund', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
      case 'ADMIN_ADJUSTMENT':
        return { label: '⚖️ Manual Adjustment', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' };
      default:
        return {
          label: tx.type === 'CREDIT' ? 'Credit' : 'Debit',
          color: tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm font-medium text-slate-500">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Wallet</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Save instantly on service bookings with your balance</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-primary-600 rounded-xl transition-all disabled:opacity-50"
          title="Refresh Balance"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
        </button>
      </div>

      {/* Hero Wallet Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-950 to-primary-900 text-white p-6 md:p-8 shadow-xl shadow-primary-950/20 border border-white/10">
        {/* Glow circles */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                <Wallet className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold text-white/80">Available Balance</span>
            </div>

            {wallet.welcomeBonusCredited && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-md">
                <Gift className="w-3.5 h-3.5" /> Bonus Claimed
              </span>
            )}
          </div>

          <div className="my-4">
            <div className="text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-bold text-amber-400">₹</span>
              {wallet.balance || 0}
            </div>
            <p className="text-xs text-white/70 mt-1 font-medium">
              Applicable up to {settings.walletDiscountPercentage}% on checkout
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-white/80">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Safe & Secure
            </span>
            <button
              onClick={() => navigate('/app/home')}
              className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 group transition-all"
            >
              Book a Service <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* How it works info box */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 flex gap-3 items-start">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-bold">How to use your wallet discount:</p>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
            <li>Select any eligible service and proceed to checkout.</li>
            <li>Toggle <strong>"Use Wallet Balance"</strong> on the booking summary.</li>
            <li>Get up to <strong>{settings.walletDiscountPercentage}%</strong> deducted directly from your final bill!</li>
          </ul>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            Wallet History
          </h2>
          <span className="text-xs font-semibold text-slate-400">
            {transactions.length} {transactions.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No transactions yet</p>
            <p className="text-xs text-slate-400">Your credits and discounts will appear right here.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-sm">
            {transactions.map((tx) => {
              const badge = getContextLabel(tx);
              const isCredit = tx.type === 'CREDIT';

              return (
                <div key={tx._id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isCredit
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {tx.description || tx.reason || (isCredit ? 'Wallet Credit' : 'Service Discount')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-base font-black ${
                        isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isCredit ? '+' : '-'} ₹{tx.amount}
                    </div>
                    {tx.balanceAfter !== undefined && (
                      <div className="text-[11px] text-slate-400 font-medium">Bal: ₹{tx.balanceAfter}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

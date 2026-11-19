import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  XCircle,
  ChevronRight,
  Info,
  PlusCircle,
  FileText,
  AlertCircle,
  ZoomIn,
  X,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { walletsApi } from '../../api/walletsApi';
import { WalletRechargeModal } from '../../components/app/WalletRechargeModal';
import { useSocket } from '../../context/SocketContext';

export default function UserWalletPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();

  const [welcomeAlert, setWelcomeAlert] = useState(location.state?.welcomeBonus || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0, welcomeBonusCredited: false });
  const [transactions, setTransactions] = useState([]);
  const [rechargeRequests, setRechargeRequests] = useState([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState('transactions'); // 'transactions' | 'recharges'
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState(null);
  const [settings, setSettings] = useState({ enabled: true, welcomeBonusAmount: 1000, walletDiscountPercentage: 20 });
  const [error, setError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const [walletRes, txRes, settingsRes, rechargeRes] = await Promise.all([
        walletsApi.getMyUserWallet().catch(() => ({ success: false })),
        walletsApi.getMyUserTransactions({ limit: 30 }).catch(() => ({ success: false })),
        walletsApi.getPublicWalletSettings().catch(() => ({ success: false })),
        walletsApi.getMyRechargeRequests({ limit: 30 }).catch(() => ({ success: false })),
      ]);

      if (walletRes?.success && walletRes?.data) {
        const walletData = walletRes.data.wallet || walletRes.data;
        const currentBal = Number(walletData.balance ?? walletData.selfBalance ?? walletRes.data.balance ?? walletRes.data.selfBalance ?? 0);
        setWallet({
          ...walletData,
          balance: currentBal,
          welcomeBonusCredited: Boolean(walletData.welcomeBonusCredited ?? walletRes.data.welcomeBonusCredited),
        });
        if (walletRes.data.settings) {
          setSettings((prev) => ({ ...prev, ...walletRes.data.settings }));
        }
      }
      if (txRes?.success && txRes?.data) {
        setTransactions(txRes.data.transactions || []);
      }
      if (settingsRes?.success && settingsRes?.data) {
        setSettings(settingsRes.data);
      }
      if (rechargeRes?.success && rechargeRes?.data) {
        setRechargeRequests(rechargeRes.data.requests || []);
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

  // Real-time socket updates for approvals, rejections, and new credits
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadData(true);
    };

    socket.on('WALLET_NOTIFICATION', handleUpdate);
    socket.on('WALLET_RECHARGE_UPDATED', handleUpdate);

    return () => {
      socket.off('WALLET_NOTIFICATION', handleUpdate);
      socket.off('WALLET_RECHARGE_UPDATED', handleUpdate);
    };
  }, [socket, loadData]);

  const getContextLabel = (tx) => {
    switch (tx.context) {
      case 'WALLET_RECHARGE':
        return { label: '💳 Wallet Recharge', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' };
      case 'SERVICE_CREDIT':
        return { label: `🎁 ${tx.metadata?.percentage || settings.serviceCreditPercentage || 15}% Service Reward`, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' };
      case 'WELCOME_BONUS':
        return { label: '🎉 Welcome Bonus', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
      case 'SERVICE_DISCOUNT':
        return { label: '🏷️ Booking Discount', color: 'bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300' };
      case 'REFUND':
        return { label: '↩️ Booking Refund', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
      case 'REVERSAL':
        return { label: '↩️ Credit Reversal', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' };
      case 'ADMIN_ADJUSTMENT':
        return { label: '⚖️ Manual Adjustment', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' };
      default:
        return {
          label: tx.type === 'CREDIT' ? 'Credit' : 'Debit',
          color: tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        };
    }
  };

  const pendingRechargesCount = rechargeRequests.filter((r) => r.status === 'PENDING').length;

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

      {/* Welcome Bonus Celebration Alert */}
      {welcomeAlert?.credited && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 shadow-lg shadow-amber-500/20 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md shrink-0">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">🎉 Welcome Bonus Credited!</p>
              <p className="text-xs text-white/90">
                {welcomeAlert.message || `₹${Number(welcomeAlert.amount).toLocaleString('en-IN')} welcome bonus has been credited to your wallet.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setWelcomeAlert(null)}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-all text-xs font-semibold"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Wallet Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-950 to-primary-900 text-white p-6 md:p-8 shadow-xl shadow-primary-950/20 border border-white/10">
        {/* Glow circles */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between min-h-[170px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                <Wallet className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold text-white/80">Available Balance</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRechargeModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition shadow-md active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Recharge Wallet
              </button>
            </div>
          </div>

          <div className="my-4">
            <div className="text-4xl md:text-5xl font-black tracking-tight text-white flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-bold text-amber-400">₹</span>
              {Number(wallet.balance ?? wallet.selfBalance ?? 0).toLocaleString('en-IN')}
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
              onClick={() => navigate('/user')}
              className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 group transition-all"
            >
              Book a Service <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Pending Recharge Notification Banner */}
      {pendingRechargesCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You have <strong>{pendingRechargesCount}</strong> recharge request awaiting administrator approval.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveHistoryTab('recharges')}
            className="font-bold underline text-amber-800 dark:text-amber-300 shrink-0 hover:text-amber-950"
          >
            View Status
          </button>
        </div>
      )}

      {/* How it works info box */}
      <div className="bg-gradient-to-r from-amber-50 to-indigo-50 dark:from-amber-950/20 dark:to-indigo-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 flex gap-3 items-start">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
          <p className="font-bold text-amber-900 dark:text-amber-200">Wallet Rewards & Benefits</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300 leading-relaxed">
            {settings.welcomeBonusEnabled !== false && (
              <li>
                <strong>₹{Number(settings.welcomeBonusAmount || 1000).toLocaleString('en-IN')} Welcome Bonus:</strong> Credited automatically to your wallet on registration to save on your service bookings.
              </li>
            )}
            <li>
              <strong>Instant Wallet Recharge:</strong> Scan our official Admin QR, submit UTR & receipt screenshot, and get credited once approved.
            </li>
            <li>
              <strong>15% Automatic Service Credit:</strong> Receive 15% of the eligible service charge credited directly to your wallet every time a booking is completed.
            </li>
            <li>
              <strong>Instant Checkout Discount:</strong> Toggle <strong>"Use Wallet Balance"</strong> during checkout to save up to <strong>{settings.walletDiscountPercentage || 20}%</strong> on your bill.
            </li>
          </ul>
        </div>
      </div>

      {/* History Section: Ledger vs Recharges Tab */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveHistoryTab('transactions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeHistoryTab === 'transactions'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Transaction Ledger ({transactions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveHistoryTab('recharges')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeHistoryTab === 'recharges'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Recharge Requests ({rechargeRequests.length})
              {pendingRechargesCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: TRANSACTION LEDGER */}
        {activeHistoryTab === 'transactions' && (
          <div>
            {transactions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No transactions yet</p>
                <p className="text-xs text-slate-400">Your credits and discounts will appear right here.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-xs">
                {transactions.map((tx) => {
                  const badge = getContextLabel(tx);
                  const isCredit = tx.type === 'CREDIT';
                  const bookingRef = tx.bookingId?._id || tx.metadata?.bookingId || (tx.referenceType === 'BOOKING' ? tx.referenceId : null);
                  const eligibleAmt = tx.metadata?.eligibleAmount || tx.bookingId?.basePrice;

                  return (
                    <div key={tx._id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
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

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.color}`}>
                              {badge.label}
                            </span>
                            {bookingRef && (
                              <>
                                <span>•</span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Ref: #{String(bookingRef).slice(-6).toUpperCase()}
                                </span>
                              </>
                            )}
                            {eligibleAmt !== undefined && (
                              <>
                                <span>•</span>
                                <span className="text-[11px] text-slate-500">
                                  Service: ₹{eligibleAmt}
                                </span>
                              </>
                            )}
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
        )}

        {/* TAB 2: RECHARGE REQUESTS LIST */}
        {activeHistoryTab === 'recharges' && (
          <div>
            {rechargeRequests.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No recharge requests yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Scan the Admin QR and submit your payment proof to top up your wallet.
                </p>
                <button
                  type="button"
                  onClick={() => setRechargeModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-xs"
                >
                  Submit Recharge Request
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-xs">
                {rechargeRequests.map((r) => {
                  const isPending = r.status === 'PENDING';
                  const isApproved = r.status === 'APPROVED';
                  const isRejected = r.status === 'REJECTED';

                  return (
                    <div key={r._id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800'
                                : isRejected
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isApproved ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isRejected ? (
                              <XCircle className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-900 dark:text-white">
                                ₹{Number(r.amount).toLocaleString('en-IN')}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isApproved
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isRejected
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 font-medium">
                              UTR: <code className="font-mono text-slate-600 dark:text-slate-300 font-bold">{r.utrNumber}</code> •{' '}
                              {new Date(r.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>

                        {r.paymentScreenshot && (
                          <button
                            type="button"
                            onClick={() => setPreviewScreenshot(r.paymentScreenshot)}
                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-teal-500 transition"
                            title="View receipt"
                          >
                            <img
                              src={r.paymentScreenshot}
                              alt="Receipt"
                              className="w-10 h-10 object-cover rounded-md"
                            />
                          </button>
                        )}
                      </div>

                      {/* Display admin rejection reason if request was rejected */}
                      {isRejected && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                          <p className="font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Rejection Reason:
                          </p>
                          <p className="pl-5 font-medium">{r.rejectionReason || 'Receipt could not be verified'}</p>
                        </div>
                      )}

                      {/* Display approval credit confirmation */}
                      {isApproved && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Amount credited to your wallet balance.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wallet Recharge Modal */}
      <WalletRechargeModal
        isOpen={rechargeModalOpen}
        onClose={() => setRechargeModalOpen(false)}
        onSuccess={() => {
          loadData(true);
          setActiveHistoryTab('recharges');
        }}
      />

      {/* Screenshot Preview Zoom */}
      {previewScreenshot && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewScreenshot(null)}
          >
            <div className="relative max-w-lg w-full bg-black rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <img src={previewScreenshot} alt="Payment Receipt" className="w-full max-h-[80vh] object-contain mx-auto" />
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

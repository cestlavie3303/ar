import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NewOrderView } from './components/NewOrderView';
import { ReservationsView } from './components/ReservationsView';
import { OrdersListView } from './components/OrdersListView';
import { TeamBoardView } from './components/TeamBoardView';
import { UserManagementView } from './components/UserManagementView';
import { LoginScreen } from './components/LoginScreen';
import { ReceiptModal } from './components/ReceiptModal';
import { ExportModal } from './components/ExportModal';
import { Order, AppUser, GroupedOrder } from './types';
import { getCairoWorkDate } from './data/constants';
import { 
  subscribeToOrders, 
  deleteOrderFromFirestore, 
  saveOrderToFirestore,
  updateOrderReservationStatusInFirestore
} from './firestoreService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('arous_damascus_auth_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.displayName) {
          user.displayName = user.displayName.replace(/\s*\(.*?\)\s*/g, '').trim() || user.displayName;
        }
        return user;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'new' | 'reservations' | 'list' | 'team' | 'users'>('new');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | GroupedOrder | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);

  const cairoToday = getCairoWorkDate();
  const pendingReservationsCount = orders.filter((o) => {
    const isRes = o.is_reservation || (o.work_date > (o.payment_shift_date || o.created_at?.slice(0, 10) || cairoToday));
    return isRes && o.reservation_status !== 'delivered';
  }).length;

  const handleLogout = () => {
    localStorage.removeItem('arous_damascus_auth_user');
    setCurrentUser(null);
    setActiveTab('new');
  };

  // Initialize and connect to Firestore real-time listener + local cache fallback
  useEffect(() => {
    if (!currentUser) return;

    try {
      const cached = localStorage.getItem('alex_receipt_orders_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          setIsLoading(false);
        }
      }
    } catch {
      // ignore
    }

    // Subscribe to Firestore for real-time automatic synchronization
    const unsubscribe = subscribeToOrders(
      (firestoreOrders) => {
        if (firestoreOrders && firestoreOrders.length > 0) {
          setOrders(firestoreOrders);
          setIsCloudSynced(true);
          setIsLoading(false);
          try {
            localStorage.setItem('alex_receipt_orders_cache', JSON.stringify(firestoreOrders));
          } catch {}
        } else {
          // If Firestore is empty initially, load from server or seed
          fetchOrdersWithRetry(0);
        }
      },
      (err) => {
        console.warn('Firestore subscription notice, utilizing server API fallback:', err);
        setIsCloudSynced(false);
        fetchOrdersWithRetry(0);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser]);

  const fetchOrdersWithRetry = async (retryCount = 0) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const ordList = data.orders || [];
        setOrders((prev) => {
          // Merge safely if firestore had items
          if (prev.length > 0 && ordList.length === 0) return prev;
          return ordList;
        });
        try {
          localStorage.setItem('alex_receipt_orders_cache', JSON.stringify(ordList));
        } catch {
          // ignore storage quota
        }
      } else {
        throw new Error(`خطأ في الخادم (${res.status})`);
      }
    } catch (err: any) {
      if (retryCount < 3) {
        setTimeout(() => {
          fetchOrdersWithRetry(retryCount + 1);
        }, 800 * (retryCount + 1));
      } else {
        setFetchError('تعذر جلب بيانات الإيصالات من الخادم حالياً. يرجى التحقق من الاتصال.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = () => fetchOrdersWithRetry(0);

  const handleOrderCreated = async (newOrder: Order) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === newOrder.id);
      const updated = exists ? prev : [newOrder, ...prev];
      try {
        localStorage.setItem('alex_receipt_orders_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Also push to Firestore directly to ensure instant multi-device cloud persistence
    try {
      await saveOrderToFirestore(newOrder);
      setIsCloudSynced(true);
    } catch (err) {
      console.warn('Firestore cloud sync fallback:', err);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      await deleteOrderFromFirestore(id).catch(() => {});
      setOrders((prev) => {
        const updated = prev.filter((o) => o.id !== id);
        try {
          localStorage.setItem('alex_receipt_orders_cache', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setSelectedOrder(null);
    } catch (err) {
      console.error('Delete order error:', err);
    }
  };

  const handleDeliverReservation = async (orderId: string) => {
    try {
      const deliveredBy = currentUser?.displayName || currentUser?.username || 'موظف';
      
      // Update locally immediately for instant feedback
      setOrders((prev) => {
        const updated = prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              reservation_status: 'delivered' as const,
              delivered_at: new Date().toISOString(),
              delivered_by: deliveredBy,
            };
          }
          return o;
        });
        try {
          localStorage.setItem('alex_receipt_orders_cache', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Update backend server
      await fetch(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: deliveredBy }),
      }).catch((err) => console.warn('Server deliver reservation fallback:', err));

      // Update Firebase Firestore
      await updateOrderReservationStatusInFirestore(orderId, 'delivered', deliveredBy).catch((err) =>
        console.warn('Firestore deliver reservation fallback:', err)
      );
    } catch (err) {
      console.error('Deliver error:', err);
    }
  };

  // If not authenticated, render the branded Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isAdmin = currentUser.role === 'admin' || currentUser.username?.toLowerCase() === 'ahmed';

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex flex-col font-['Cairo',sans-serif] text-stone-900 selection:bg-red-900 selection:text-amber-200">
      {/* Top App Bar with Navigation & User Status */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExport={() => setIsExportModalOpen(true)}
        ordersCount={orders.length}
        reservationsCount={pendingReservationsCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Network / Connection Recovery Banner */}
      {fetchError && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-bold shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={() => fetchOrders()}
              className="bg-amber-700 hover:bg-amber-800 text-white font-black px-4 py-1.5 rounded-xl transition shadow-xs"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'new' && (
          <NewOrderView
            onOrderCreated={handleOrderCreated}
            onNavigateToList={() => setActiveTab('list')}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'reservations' && (
          <ReservationsView
            orders={orders}
            onSelectOrder={setSelectedOrder}
            onDeliverReservation={handleDeliverReservation}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'list' && (
          <OrdersListView
            orders={orders}
            onSelectOrder={setSelectedOrder}
            onOpenExport={() => setIsExportModalOpen(true)}
            isLoading={isLoading}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'team' && (
          <TeamBoardView onSelectOrder={setSelectedOrder} />
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagementView currentUser={currentUser} />
        )}
      </main>

      {/* Receipt Full Detail Modal */}
      <ReceiptModal
        order={selectedOrder}
        allOrders={orders}
        onClose={() => setSelectedOrder(null)}
        onDeleteOrder={handleDeleteOrder}
      />

      {/* Export to Excel Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        currentUser={currentUser}
      />

      {/* Corporate Executive Footer */}
      <footer className="py-4 border-t border-stone-200/90 bg-stone-900 text-stone-400 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            <span className="font-bold text-stone-300"></span>
            <span className="text-stone-500"></span>
            <span className="text-stone-400"></span>
          </div>
          <span className="text-stone-500 text-[11px]">
           
          </span>
        </div>
      </footer>
    </div>
  );
}

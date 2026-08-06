import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bell, ShoppingBag, MessageSquare, Mail, CheckCircle, Package } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function AdminNotifications({ setDashboardView, setActiveOrderId }: any) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  
  useEffect(() => {
    // We will listen to orders, inquiries, chats and generate a timeline
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10));
    const qInquiries = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'), limit(10));
    const qChats = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'), limit(10));

    let allNotifs: any[] = [];
    
    const updateNotifs = () => {
      // Sort and update
      const sorted = [...allNotifs].sort((a, b) => b.time - a.time).slice(0, 30);
      setNotifications(sorted);
      
      const lastRead = localStorage.getItem('admin_notif_read_time') || '0';
      const count = sorted.filter(n => n.time > parseInt(lastRead)).length;
      setUnreadCount(count);
    };

    const unsubOrders = onSnapshot(qOrders, snap => {
      const orders = snap.docs.map(d => ({...(d.data() as any), id: d.id}));
      // Filter out existing orders from the array
      allNotifs = allNotifs.filter(n => n.type !== 'order');
      
      orders.forEach(o => {
        allNotifs.push({
          id: `order_${o.id}`,
          type: 'order',
          title: 'New Order Received',
          message: `${o.name} placed an order for INR ${o.amount}`,
          time: o.createdAt,
          refId: o.id,
          status: o.status
        });
        
        if (o.paymentStatus === 'Verified' || o.paymentStatus === 'Paid') {
          allNotifs.push({
            id: `payment_${o.id}`,
            type: 'payment',
            title: 'Payment Verified',
            message: `Order ${o.id} payment verified`,
            time: o.createdAt + 1000, // rough approx
            refId: o.id
          });
        }
      });
      updateNotifs();
    });

    const unsubInquiries = onSnapshot(qInquiries, snap => {
      const inqs = snap.docs.map(d => ({...(d.data() as any), id: d.id}));
      allNotifs = allNotifs.filter(n => n.type !== 'inquiry');
      inqs.forEach(i => {
        allNotifs.push({
          id: `inq_${i.id}`,
          type: 'inquiry',
          title: 'New Inquiry',
          message: `${i.name}: ${i.message?.substring(0, 30)}...`,
          time: i.createdAt,
          refId: i.id
        });
      });
      updateNotifs();
    });

    const unsubChats = onSnapshot(qChats, snap => {
      const chats = snap.docs.map(d => ({...(d.data() as any), id: d.id}));
      allNotifs = allNotifs.filter(n => n.type !== 'chat');
      chats.forEach(c => {
        if (c.unreadAdmin > 0) {
          allNotifs.push({
            id: `chat_${c.id}`,
            type: 'chat',
            title: 'New Chat Message',
            message: `${c.userName}: ${c.lastMessage?.substring(0,30)}`,
            time: c.lastMessageAt,
            refId: c.id
          });
        }
      });
      updateNotifs();
    });

    return () => {
      unsubOrders();
      unsubInquiries();
      unsubChats();
    };
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      localStorage.setItem('admin_notif_read_time', Date.now().toString());
      setUnreadCount(0);
    }
  };

  const handleAction = (n: any) => {
    setIsOpen(false);
    if (n.type === 'order' || n.type === 'payment') {
      setDashboardView('orders');
      if (setActiveOrderId) setActiveOrderId(n.refId);
    } else if (n.type === 'inquiry') {
      setDashboardView('inquiries');
    } else if (n.type === 'chat') {
      setDashboardView('chat');
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={handleOpen}
        className="w-10 h-10 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-amber-500 hover:border-amber-500/50 transition-colors relative"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-black shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
            <h3 className="font-bold uppercase tracking-widest text-xs text-neutral-200">Notifications</h3>
            {unreadCount > 0 && <span className="text-xs text-amber-500 font-bold">{unreadCount} New</span>}
          </div>
          <div className="flex-1 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs">No notifications yet.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map(n => (
                  <button 
                    key={n.id}
                    onClick={() => handleAction(n)}
                    className="w-full text-left p-4 hover:bg-white/5 transition-colors flex gap-3 group"
                  >
                    <div className="mt-1 text-amber-500 group-hover:scale-110 transition-transform">
                      {n.type === 'order' && <ShoppingBag size={16} />}
                      {n.type === 'inquiry' && <Mail size={16} />}
                      {n.type === 'chat' && <MessageSquare size={16} />}
                      {n.type === 'payment' && <CheckCircle size={16} className="text-green-500" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-200">{n.title}</h4>
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <span className="text-[10px] text-neutral-600 block mt-1">
                        {new Date(n.time).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

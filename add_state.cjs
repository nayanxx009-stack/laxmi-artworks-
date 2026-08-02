const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const oldState = `  const [activeTab, setActiveTab] = useState<'dashboard' | 'site' | 'admins' | 'gallery'>('dashboard');
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalReviews: 0, totalSubscribers: 0, revenue: 0 });`;

const newState = `  const [activeTab, setActiveTab] = useState<'dashboard' | 'site' | 'admins' | 'gallery'>('dashboard');
  const [dashboardView, setDashboardView] = useState<'orders' | 'users' | 'subscribers' | 'reviews'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalReviews: 0, totalSubscribers: 0, revenue: 0 });`;

code = code.replace(oldState, newState);
fs.writeFileSync('src/components/AdminPanel.tsx', code);

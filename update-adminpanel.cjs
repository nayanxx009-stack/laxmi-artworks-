const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Replace standard auth stuff with useAuth
code = code.replace(
  `import { onAuthStateChanged, signInWithPopup, signOut, User, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';`,
  `import { useAuth } from '../lib/auth';`
);

// We need to carefully replace the top of AdminPanel component
const adminStart = `export default function AdminPanel() {`;
const fetchAdminsStart = `  const fetchAdmins = async () => {`;

if (code.includes(adminStart) && code.includes(fetchAdminsStart)) {
  const parts = code.split(fetchAdminsStart);
  
  let newTop = `export default function AdminPanel() {
  const { user, role, logout } = useAuth();
  
  const [isAdmin, setIsAdmin] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<'none' | 'setup' | 'enter'>('none');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'site' | 'admins' | 'gallery' | 'system'>('dashboard');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [dashboardView, setDashboardView] = useState<"orders" | "users" | "subscribers" | "reviews" | "analytics" | "backup" | "coupons" | "chat">("analytics");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalReviews: 0, totalSubscribers: 0, totalRevenue: 0, totalOrders: 0, totalInquiries: 0 });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const siteConfig = useSiteConfig();
  const [localSiteConfig, setLocalSiteConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [isUploadingPopup, setIsUploadingPopup] = useState(false);
  const [showPopupPreview, setShowPopupPreview] = useState(false);
  const [savingSite, setSavingSite] = useState(false);

  const [adminsList, setAdminsList] = useState<{id: string, email: string, role?: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [gallery, setGallery] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [newGalleryItem, setNewGalleryItem] = useState({ title: '', img: '', cat: 'Fine Art' });
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSiteConfig(siteConfig);
  }, [siteConfig]);

  useEffect(() => {
    if (user && role === 'admin') {
      const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "admin@example.com"];
      setIsOwner(MASTER_ADMINS.includes(user.email?.toLowerCase() || ''));
      setCheckingAuth(false);
    }
  }, [user, role]);

`;
  
  const bottomHalf = parts[1];
  code = code.substring(0, code.indexOf(adminStart)) + newTop + `  const fetchAdmins = async () => {\n` + bottomHalf;
  
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Updated AdminPanel.tsx top");
} else {
  console.log("Could not find delimiters");
}

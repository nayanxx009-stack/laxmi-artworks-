const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const effectToReplace = `  useEffect(() => {
    if (user && role === 'admin') {
      const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "admin@example.com"];
      setIsOwner(MASTER_ADMINS.includes(user.email?.toLowerCase() || ''));
      setIsAdmin(true);
      setPasswordFlow('none');
      setCheckingAuth(false);
    } else {
      setIsAdmin(false);
      setIsOwner(false);
    }
  }, [user, role]);`;

const newEffect = `  useEffect(() => {
    let active = true;
    const checkAdminData = async () => {
      if (user && role === 'admin') {
        const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "admin@example.com"];
        if (active) setIsOwner(MASTER_ADMINS.includes(user.email?.toLowerCase() || ''));
        if (active) setIsAdmin(true);
        
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.email!));
          if (adminDoc.exists() && adminDoc.data().password) {
            if (active) setPasswordFlow('enter');
          } else {
            if (active) setPasswordFlow('setup');
          }
        } catch (e) {
          console.error(e);
          if (active) setPasswordFlow('setup');
        }
        
        if (active) setCheckingAuth(false);
      } else {
        if (active) setIsAdmin(false);
        if (active) setIsOwner(false);
      }
    };
    if (user && role === 'admin') {
      checkAdminData();
    } else if (!user || role !== 'admin') {
      setIsAdmin(false);
      setIsOwner(false);
    }
    return () => { active = false; };
  }, [user, role]);`;

code = code.replace(effectToReplace, newEffect);

const submitToReplace = `  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
  };`;

const newSubmit = `  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!adminPasswordInput) return;
    
    try {
      const adminDocRef = doc(db, 'admins', user!.email!);
      const adminDoc = await getDoc(adminDocRef);
      
      if (passwordFlow === 'setup') {
        await setDoc(adminDocRef, {
           email: user!.email!,
           password: adminPasswordInput,
           role: 'admin',
           updatedAt: Date.now()
        }, { merge: true });
        setPasswordFlow('none');
      } else if (passwordFlow === 'enter') {
         if (adminDoc.exists() && adminDoc.data().password === adminPasswordInput) {
            setPasswordFlow('none');
         } else {
            setPasswordError('Incorrect password.');
         }
      }
    } catch (err) {
      console.error(err);
      setPasswordError('Error verifying password.');
    }
  };`;

code = code.replace(submitToReplace, newSubmit);

const uiToInsertBefore = `  if (!user) {
    return (
      <div className="min-h-screen`;

const newUI = `  if (passwordFlow !== 'none') {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white p-4">
        <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
          <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">
            {passwordFlow === 'setup' ? 'Setup Admin Password' : 'Enter Admin Password'}
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            {passwordFlow === 'setup' 
              ? 'Create a secondary password for your admin account.' 
              : 'Enter your secondary password to access the admin panel.'}
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input 
              type="password" 
              placeholder="Admin Password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
              required
            />
            {passwordError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {passwordError}
              </div>
            )}
            <button 
              type="submit"
              className="w-full bg-amber-500 text-black font-bold py-3 px-4 rounded-xl hover:bg-amber-400 transition-colors"
            >
              {passwordFlow === 'setup' ? 'Set Password' : 'Verify Password'}
            </button>
            {passwordFlow === 'enter' && (
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-neutral-500 hover:text-white mt-4 block mx-auto"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen`;

code = code.replace(uiToInsertBefore, newUI);

fs.writeFileSync('src/components/AdminPanel.tsx', code);

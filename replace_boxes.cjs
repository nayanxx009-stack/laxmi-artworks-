const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const oldBoxes = `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <Users className="w-6 h-6 text-amber-500 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Total Users (Engaged)</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white relative z-10">{stats.totalUsers}</p>
                </div>
                <div className="bg-neutral-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <Mail className="w-6 h-6 text-blue-400 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Email Subscribers</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-400 relative z-10">{stats.totalSubscribers}</p>
                </div>
                <div className="bg-neutral-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <MessageSquare className="w-6 h-6 text-purple-400 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Reviews Collected</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-400 relative z-10">{stats.totalReviews}</p>
                </div>
                <div className="bg-neutral-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <IndianRupee className="w-6 h-6 text-green-400 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Advance Collected</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-400 relative z-10">₹{stats.revenue}</p>
                </div>
              </div>`;

const newBoxes = `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div 
                  onClick={() => setDashboardView('users')}
                  className={\`bg-neutral-900 border \${dashboardView === 'users' ? 'border-amber-500' : 'border-white/5'} p-6 rounded-3xl relative overflow-hidden group cursor-pointer transition-colors\`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <Users className="w-6 h-6 text-amber-500 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Total Users (Engaged)</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white relative z-10">{stats.totalUsers}</p>
                </div>
                <div 
                  onClick={() => setDashboardView('subscribers')}
                  className={\`bg-neutral-900 border \${dashboardView === 'subscribers' ? 'border-amber-500' : 'border-white/5'} p-6 rounded-3xl relative overflow-hidden group cursor-pointer transition-colors\`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <Mail className="w-6 h-6 text-blue-400 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Email Subscribers</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-400 relative z-10">{stats.totalSubscribers}</p>
                </div>
                <div 
                  onClick={() => setDashboardView('reviews')}
                  className={\`bg-neutral-900 border \${dashboardView === 'reviews' ? 'border-amber-500' : 'border-white/5'} p-6 rounded-3xl relative overflow-hidden group cursor-pointer transition-colors\`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <MessageSquare className="w-6 h-6 text-purple-400 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Reviews Collected</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-400 relative z-10">{stats.totalReviews}</p>
                </div>
                <div 
                  onClick={() => setDashboardView('orders')}
                  className={\`bg-neutral-900 border \${dashboardView === 'orders' ? 'border-amber-500' : 'border-white/5'} p-6 rounded-3xl relative overflow-hidden group cursor-pointer transition-colors\`}
                >
                   <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150 duration-700"></div>
                  <IndianRupee className="w-6 h-6 text-green-400 mb-3 relative z-10" />
                  <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-1 relative z-10">Orders (Advance)</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-400 relative z-10">₹{stats.revenue}</p>
                </div>
              </div>`;

code = code.replace(oldBoxes, newBoxes);
fs.writeFileSync('src/components/AdminPanel.tsx', code);

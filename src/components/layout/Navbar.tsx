import { NavLink } from 'react-router-dom';
import { Activity, BarChart2, Zap, Gavel, Eye, Layers, Shield } from 'lucide-react';
import clsx from 'clsx';

export const Navbar = () => {
  const navItems = [
    { name: 'Markets', path: '/', icon: Activity },
    { name: 'Trade', path: '/chart', icon: BarChart2 },
    { name: 'Track', path: '/track', icon: Eye },
    { name: 'Walls', path: '/walls', icon: Layers },
    { name: 'Auctions', path: '/auctions', icon: Gavel },
    { name: 'Token', path: '/tokens', icon: Zap },
    { name: 'Health', path: '/latency', icon: Shield },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-dark-1000 border-b border-dark-900 z-50 flex items-center justify-between px-6">
      {/* BRANDING */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-brand-neon" />
        </div>
        <span className="text-xl font-black uppercase tracking-tighter text-white">
          HyperSight
        </span>
      </div>

      {/* NAVIGATION */}
      <div className="flex items-center gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'relative flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300',
                isActive 
                  ? 'text-brand-neon' 
                  : 'text-dark-500 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={clsx("w-3.5 h-3.5 transition-all", isActive ? "scale-110" : "opacity-60")} />
                {item.name}
                {isActive && (
                  <motion.div 
                    layoutId="nav-glow"
                    className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-brand-neon shadow-[0_0_15px_rgba(0,255,163,0.5)]" 
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="flex items-center">
        <button className="px-6 py-2 bg-dark-900 border border-dark-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-brand-neon hover:text-brand-neon transition-all hover:shadow-[0_0_20px_rgba(0,255,163,0.1)]">
          Connect Wallet
        </button>
      </div>
    </nav>
  );
};

// Simplified motion component requirement (App.tsx usually has Framer Motion context)
import { motion } from 'framer-motion';

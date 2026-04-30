import { 
  Crosshair, 
  Minus, 
  Layers, 
  Brush, 
  Type, 
  Smile, 
  Ruler, 
  Search, 
  Magnet, 
  Pencil, 
  Eye, 
  Trash2,
  Lock,
  Square
} from 'lucide-react';
import { useStore } from '../../store';
import clsx from 'clsx';

interface ToolbarButtonProps {
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
  tooltip: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, active, onClick, tooltip }) => (
  <button
    onClick={() => {
      console.log('[Toolbar] Tool icon Clicked:', tooltip);
      if (onClick) onClick();
    }}
    title={tooltip}
    className={clsx(
      "w-9 h-9 flex items-center justify-center rounded-lg transition-all relative group",
      active 
        ? "bg-brand-neon/10 text-brand-neon shadow-[0_0_10px_rgba(0,255,163,0.1)]" 
        : "text-dark-500 hover:bg-dark-800 hover:text-white"
    )}
  >
    <Icon size={18} strokeWidth={1.5} />
    <span className="absolute left-full ml-2 px-2 py-1 bg-dark-900 border border-dark-800 text-[10px] text-white font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
      {tooltip}
    </span>
    {active && <div className="absolute left-0 w-0.5 h-4 bg-brand-neon rounded-full" />}
  </button>
);

export const DrawingToolbar = () => {
  const activeTool = useStore((s) => s.activeDrawingTool);
  const setActiveTool = useStore((s) => s.setActiveDrawingTool);

  return (
    <div className="w-[45px] flex flex-col items-center py-2 bg-dark-1000 border-r border-dark-900 flex-shrink-0 hide-scrollbar overflow-y-auto">
      <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
        <ToolbarButton 
          icon={Crosshair} 
          active={activeTool === 'crosshair'} 
          onClick={() => setActiveTool('crosshair')}
          tooltip="Crosshair (C)"
        />
        <ToolbarButton 
          icon={Minus} 
          active={activeTool === 'trendline'} 
          onClick={() => setActiveTool('trendline')}
          tooltip="Trendline (Alt+T)"
        />
        <ToolbarButton 
          icon={Layers} 
          active={activeTool === 'fib'} 
          onClick={() => setActiveTool('fib')}
          tooltip="Fibonacci Retracement"
        />
        <ToolbarButton 
          icon={Square} 
          active={activeTool === 'shapes'} 
          onClick={() => setActiveTool('shapes')}
          tooltip="Geometric Shapes"
        />
        <ToolbarButton 
          icon={Brush} 
          active={activeTool === 'brush'} 
          onClick={() => setActiveTool('brush')}
          tooltip="Brush"
        />
        <ToolbarButton 
          icon={Type} 
          active={activeTool === 'text'} 
          onClick={() => setActiveTool('text')}
          tooltip="Text (T)"
        />
        <ToolbarButton 
          icon={Smile} 
          active={activeTool === 'icons'} 
          onClick={() => setActiveTool('icons')}
          tooltip="Icons"
        />
        
        <div className="w-6 h-px bg-dark-900 my-2" />

        <ToolbarButton 
          icon={Ruler} 
          active={activeTool === 'measure'} 
          onClick={() => setActiveTool('measure')}
          tooltip="Measure"
        />
        <ToolbarButton 
          icon={Search} 
          active={activeTool === 'zoom'} 
          onClick={() => setActiveTool('zoom')}
          tooltip="Zoom"
        />
        <ToolbarButton 
          icon={Magnet} 
          active={activeTool === 'magnet'} 
          onClick={() => setActiveTool('magnet')}
          tooltip="Magnet"
        />

        <div className="w-6 h-px bg-dark-900 my-2" />

        <ToolbarButton 
          icon={Pencil} 
          tooltip="Stay in Drawing Mode"
        />
        <ToolbarButton 
          icon={Lock} 
          tooltip="Lock All Drawing Tools"
        />
        <ToolbarButton 
          icon={Eye} 
          tooltip="Hide All Drawings"
        />
        
        <div className="mt-auto pt-4">
          <ToolbarButton 
            icon={Trash2} 
            tooltip="Remove Drawings"
            onClick={() => setActiveTool('trash')}
          />
        </div>
      </div>
    </div>
  );
};

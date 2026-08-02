import { useSiteConfig } from '../lib/SiteContext';

export default function TopBanner() {
  const { announcementVisible, announcementBanner } = useSiteConfig();

  if (!announcementVisible) return null;

  return (
    <div className="bg-amber-500 text-[#030303] py-2 overflow-hidden flex whitespace-nowrap relative z-[60] border-b border-amber-600/50">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] cursor-default">
        {/* Render identical blocks so translating by -50% perfectly loops */}
        <div className="flex shrink-0">
          {[1,2,3,4,5].map((_, index) => (
            <span key={`first-${index}`} className="mx-6 sm:mx-10 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]">
              {announcementBanner}
            </span>
          ))}
        </div>
        <div className="flex shrink-0">
          {[1,2,3,4,5].map((_, index) => (
            <span key={`second-${index}`} className="mx-6 sm:mx-10 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]">
              {announcementBanner}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const regex = /\{showPopupPreview && \(\s*<div className="fixed inset-0 z-\[100\] flex items-center justify-center p-4 bg-black\/80 backdrop-blur-sm">\s*<div className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl">\s*<button onClick=\{\(\) => setShowPopupPreview\(false\)\} className="absolute top-4 right-4 z-10 p-2 bg-black\/50 hover:bg-black\/80 text-white rounded-full transition-colors backdrop-blur-md">\s*<X size=\{20\} \/>\s*<\/button>\s*\{localSiteConfig\.popupImage \? \(\s*<img src=\{localSiteConfig\.popupImage\} alt="Announcement" className="w-full object-contain max-h-\[85vh\] bg-black" \/>\s*\) : \(\s*<div className="w-full h-64 bg-neutral-900 flex items-center justify-center text-neutral-500">No image uploaded<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\)\}/;

const replacement = `{showPopupPreview && typeof document !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl">
                  <button onClick={() => setShowPopupPreview(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md">
                    <X size={20} />
                  </button>
                  {localSiteConfig.popupImage ? (
                    <img src={localSiteConfig.popupImage} alt="Announcement" className="w-full object-contain max-h-[85vh] bg-black" />
                  ) : (
                    <div className="w-full h-64 bg-neutral-900 flex items-center justify-center text-neutral-500">No image uploaded</div>
                  )}
                </div>
              </div>,
              document.body
            )}`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/AdminPanel.tsx', code);

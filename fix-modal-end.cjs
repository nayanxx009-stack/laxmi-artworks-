const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const origEnd = `          </div>,
          document.body
        )}
      </AnimatePresence>`;

const replEnd = `          </div>
          )}
        </AnimatePresence>,
        document.body
      )}`;

code = code.replace(origEnd, replEnd);
fs.writeFileSync('src/components/AdminPanel.tsx', code);

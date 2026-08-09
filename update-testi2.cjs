const fs = require('fs');
let code = fs.readFileSync('src/components/Testimonials.tsx', 'utf8');

const targetStr = `              <p className="text-neutral-300 font-light leading-relaxed italic mb-8 flex-grow">
                "{test.comment}"
              </p>`;

const newStr = `              <p className="text-neutral-300 font-light leading-relaxed italic mb-4 flex-grow">
                "{test.comment}"
              </p>
              {test.adminReply && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6">
                  <p className="text-amber-500 font-bold text-xs uppercase tracking-widest mb-1">Reply from Laxmi Artworks</p>
                  <p className="text-amber-100/80 text-sm font-light">"{test.adminReply}"</p>
                </div>
              )}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  
  // also add it to interface
  code = code.replace(
    `  status: string;`,
    `  status: string;\n  adminReply?: string;`
  );
  
  fs.writeFileSync('src/components/Testimonials.tsx', code);
  console.log("Updated Testimonials with adminReply");
} else {
  console.log("Could not find target string in Testimonials.tsx");
}

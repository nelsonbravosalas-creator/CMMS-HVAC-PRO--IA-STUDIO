const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');

// 1. We want EVERYTHING from top until inside startServer
let out = '';
let inStartServer = false;
let lines = content.split('\n');

out += `// API FALLBACK GENERATED FROM server.ts\n`;

for(let i=0; i<lines.length; i++) {
  let line = lines[i];

  if(line.includes('async function startServer() {')) {
     inStartServer = true;
     // skip startServer declaration
     // We need to define app since it was in startServer
     out += `\nconst app = express();\n`;
     out += `app.use(express.json({ limit: '50mb' }));\n`;
     out += `app.use(express.urlencoded({ limit: '50mb', extended: true }));\n\n`;
     // execute ensureTables optionally or silently in background
     out += `ensureTables().catch(console.error);\n\n`;
     i += 6; // skip the next 6 lines which contain app=express() etc
     continue;
  }
  
  if(inStartServer) {
    if(line.includes('// Vite middleware for development')) {
       break; // stop including vite and static serving and app.listen
    }
  }

  if (line.includes('startServer();')) continue;
  
  out += line + '\n';
}

out += `
  // global error trap
  app.use((err, req, res, next) => {
    console.error('VERCEL ERROR:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  export default app;
`;

fs.writeFileSync('api/server.ts', out);
console.log('Fixed api/server.ts');

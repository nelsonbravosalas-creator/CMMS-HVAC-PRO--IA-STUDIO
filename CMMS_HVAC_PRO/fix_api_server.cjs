const fs = require('fs');

const serverContent = fs.readFileSync('server.ts', 'utf-8');

// I will extract the parts that define express routes and create a fresh api/server.ts
let apiServerContent = serverContent;

// Remove app.listen and vite middleware inside startServer()
apiServerContent = apiServerContent.replace(/app\.listen\([\s\S]+?\}\);/g, '');
apiServerContent = apiServerContent.replace(/if\s*\(process\.env\.NODE_ENV\s*!==\s*"production"\)[\s\S]+?\}\s*else\s*\{[\s\S]+?\.html'\)\);\n\s*\}/g, '');
apiServerContent = apiServerContent.replace('startServer();', '');
apiServerContent = apiServerContent.replace('async function startServer() {', '');

// the last brace is for startServer
apiServerContent = apiServerContent.replace(/}\s*$/, '');

apiServerContent += '\nexport default app;\n';

fs.writeFileSync('api/server.ts', apiServerContent);
console.log('Fixed api/server.ts');

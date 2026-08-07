import fs from 'fs';
import path from 'path';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // Replace imports without extensions
      const updated = content.replace(/from '(\.[^']+)'/g, (match, p1) => {
        if (!p1.endsWith('.js') && !p1.endsWith('.ts')) {
          return `from '${p1}.js'`;
        }
        return match;
      });

      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf-8');
        console.log(`Updated missing extensions in ${fullPath}`);
      }
    }
  }
}

walk('./server');
walk('./api');

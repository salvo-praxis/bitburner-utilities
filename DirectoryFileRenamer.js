const fs = require('fs');
const path = require('path');

// Directories to skip
const SKIP_DIRS = [
    'node_modules',
    '.git',
    '.idea',
    'dist'
];

function renameJsToTs(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        // Skip excluded directories
        if (file.isDirectory()) {
            if (SKIP_DIRS.includes(file.name)) {
                console.log(`Skipping directory: ${file.name}`);
                continue;
            }
            renameJsToTs(fullPath);
        } else if (file.name.endsWith('.js')) {
            const newPath = fullPath.replace('.js', '.ts');
            console.log(`Renaming: ${file.name} -> ${path.basename(newPath)}`);
            fs.renameSync(fullPath, newPath);
        }
    }
}

// Specific directories to process
const dirsToFix = [
    './src',
    './src/scripts',
    './src/scripts/singularity'
];

console.log('Will rename .js to .ts files in these directories:', dirsToFix);
console.log('Press Ctrl+C now if this is not what you want...');
setTimeout(() => {
    dirsToFix.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`\nProcessing directory: ${dir}`);
            renameJsToTs(dir);
        } else {
            console.log(`Directory does not exist, creating: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}, 5000); // 5 second delay to cancel if needed

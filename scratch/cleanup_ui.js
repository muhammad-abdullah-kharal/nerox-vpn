const fs = require('fs');
const path = 'c:\\Users\\AFZAL COMPUTERS\\Documents\\vpn-app\\screen\\MainScreen.js';
let content = fs.readFileSync(path, 'utf8');

// We use a regex to find the problematic block and replace it with a clean one
const regex = /{uploadSpeed}<\/Text>\s*<\/View>\s*<\/View>\s*<\/View>\s*<\/View>\s*<\/View>/m;
const cleanBlock = `{uploadSpeed}</Text>
                        </View>
                     </View>
                  </View>`;

if (regex.test(content)) {
    content = content.replace(regex, cleanBlock);
    console.log('✅ Cleaned up duplicate tags.');
} else {
    console.log('❌ Could not find duplicate pattern. Trying alternative...');
    // Fallback: If we can't find it exactly, we'll try a simpler match
    content = content.replace(/{uploadSpeed}<\/Text>(\s*<\/View>){4,}/m, cleanBlock);
}

fs.writeFileSync(path, content);
console.log('🚀 Final UI Cleanup complete!');

const fs = require('fs');
const path = 'c:\\Users\\AFZAL COMPUTERS\\Documents\\vpn-app\\screen\\MainScreen.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Fix the missing closing tag for speedRow
// We look for where Upload speed ends and the chart comment begins
const searchStr = '                          <Text style={styles.speedValue}>{uploadSpeed}</Text>\r\n                        </View>\r\n                     </View>';
const replacementStr = '                          <Text style={styles.speedValue}>{uploadSpeed}</Text>\r\n                        </View>\r\n                     </View>\r\n                  </View>';

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replacementStr);
    console.log('✅ Found and fixed speedRow closing tag.');
} else {
    // Try with different line endings
    const searchStrLF = searchStr.replace(/\r\n/g, '\n');
    const replacementStrLF = replacementStr.replace(/\r\n/g, '\n');
    if (content.includes(searchStrLF)) {
        content = content.replace(searchStrLF, replacementStrLF);
        console.log('✅ Found and fixed speedRow closing tag (LF).');
    } else {
        console.log('❌ Could not find exact speedRow block. Trying partial match...');
        const partial = '{uploadSpeed}</Text>';
        content = content.replace(partial, partial + '\n                        </View>\n                     </View>\n                  </View>');
    }
}

// 2. Fix the connectArea spacing (push statusImg down)
content = content.replace("statusImg: { width: 140, height: 24, marginTop: 15 }", "statusImg: { width: 140, height: 24, marginTop: 45 }");
content = content.replace("connectArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }", "connectArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 30 }");

fs.writeFileSync(path, content);
console.log('🚀 UI Hardening script completed!');

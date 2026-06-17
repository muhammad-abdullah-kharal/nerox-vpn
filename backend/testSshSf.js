require('dotenv').config();
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function run() {
  const host = '64.23.142.203';
  const user = 'root';
  const port = '22';
  const keyPath = process.env.SSH_PRIVATE_KEY_PATH || '/root/.ssh/id_rsa';
  
  const command = `echo hello`;

  console.log('Key path:', keyPath);
  console.log('Command:', command);

  const args = [
    '-i', keyPath,
    '-p', port,
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=10',
    `${user}@${host}`,
    command
  ];

  try {
    const { stdout, stderr } = await execFileAsync('ssh', args, { timeout: 20000 });
    console.log('STDOUT:', stdout.toString());
    console.log('STDERR:', stderr.toString());
    console.log('SUCCESS');
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}
run();

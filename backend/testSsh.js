require('dotenv').config();
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function run() {
  const host = '178.128.233.82';
  const user = 'root';
  const port = '22';
  const keyPath = process.env.SSH_PRIVATE_KEY_PATH;
  const testPubKey = '0c7oFQ9Q1ME1d7+izTHHhbSs56tMEaNwZxthVnVfgCA=';
  const ip = '10.8.0.51';
  const command = `wg set wg0 peer ${testPubKey} allowed-ips ${ip}/32`;

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
    console.log('STDOUT:', stdout);
    console.log('STDERR:', stderr);
    console.log('SUCCESS');
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('stderr:', err.stderr);
    console.error('stdout:', err.stdout);
  }
}
run();

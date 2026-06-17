const { exec } = require('child_process');
const dgram = require('dgram');

const serverIP = '64.23.142.203';
const port = 51820;

const p = exec(`ssh -i "C:\\Users\\AFZAL COMPUTERS\\.ssh\\nerox_backend_rsa" -o StrictHostKeyChecking=no root@${serverIP} "timeout 10 tcpdump -i eth0 udp port ${port} -n"`);
p.stdout.on('data', console.log);
p.stderr.on('data', console.error);

setTimeout(() => {
  const client = dgram.createSocket('udp4');
  client.send('ping', port, serverIP, (err) => {
    client.close();
  });
}, 4000);

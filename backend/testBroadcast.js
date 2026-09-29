const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 5005,
  path: '/api/v1/admin/debug/broadcast',
  method: 'POST'
}, res => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req.on('error', e => console.error(e));
req.end();

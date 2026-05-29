import mongoose from 'mongoose';
import dns from 'dns';
import net from 'net';
import tls from 'tls';

const testConnection = (host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);
    socket.on('connect', () => {
      socket.destroy();
      resolve({ host, port, status: 'Connected successfully' });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ host, port, status: 'Connection timed out' });
    });
    socket.on('error', (err) => {
      socket.destroy();
      resolve({ host, port, status: `Connection failed: ${err.message}` });
    });
    socket.connect(port, host);
  });
};

const testTlsConnection = (host, port) => {
  return new Promise((resolve) => {
    const socket = tls.connect(port, host, { servername: host }, () => {
      const authorized = socket.authorized;
      const authorizationError = socket.authorizationError;
      socket.destroy();
      resolve({ host, port, status: 'TLS Connected', authorized, authorizationError });
    });
    socket.setTimeout(4000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ host, port, status: 'TLS Connection timed out' });
    });
    socket.on('error', (err) => {
      socket.destroy();
      resolve({ host, port, status: `TLS Connection failed: ${err.message}` });
    });
  });
};

const diagnoseConnection = async () => {
  console.log('\n🔍 --- STARTING NETWORK DIAGNOSTICS FOR MONGODB ATLAS ---');
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('❌ MONGO_URI is not defined in environment variables.');
    return;
  }

  const match = uri.match(/@([^/?#]+)/);
  if (!match) {
    console.log('❌ Could not parse host from MONGO_URI.');
    return;
  }
  const fullHost = match[1];
  console.log(`Parsed Atlas Host: ${fullHost}`);

  const isSrv = uri.startsWith('mongodb+srv://');
  console.log(`Connection Type: ${isSrv ? 'mongodb+srv (SRV DNS)' : 'mongodb (Standard)'}`);

  if (isSrv) {
    const srvRecord = `_mongodb._tcp.${fullHost}`;
    console.log(`Resolving SRV Record: ${srvRecord}...`);
    try {
      const addresses = await dns.promises.resolveSrv(srvRecord);
      console.log('✅ DNS SRV resolution successful! Found hosts:');
      for (const addr of addresses) {
        console.log(`  - ${addr.name}:${addr.port}`);
      }
      
      for (const addr of addresses) {
        console.log(`Testing TCP connection to ${addr.name}:${addr.port}...`);
        const result = await testConnection(addr.name, addr.port);
        console.log(`  ➔ TCP Status: ${result.status}`);
        
        if (result.status === 'Connected successfully') {
          console.log(`Testing TLS connection to ${addr.name}:${addr.port}...`);
          const tlsResult = await testTlsConnection(addr.name, addr.port);
          console.log(`  ➔ TLS Status: ${tlsResult.status} (Authorized: ${tlsResult.authorized}, Error: ${tlsResult.authorizationError || 'None'})`);
        }
      }
    } catch (err) {
      console.log(`❌ DNS SRV resolution failed: ${err.message}`);
      console.log('👉 This usually means your DNS server (e.g. your local router or ISP) is blocking SRV records, or the host domain is incorrect.');
      
      console.log(`Attempting standard DNS lookup for ${fullHost}...`);
      try {
        const ip = await dns.promises.lookup(fullHost);
        console.log(`✅ Standard DNS lookup successful: ${ip.address}`);
      } catch (lookupErr) {
        console.log(`❌ Standard DNS lookup failed too: ${lookupErr.message}`);
      }
    }
  } else {
    const hostOnly = fullHost.split(':')[0];
    const port = parseInt(fullHost.split(':')[1]) || 27017;
    console.log(`Testing TCP connection to ${hostOnly}:${port}...`);
    const result = await testConnection(hostOnly, port);
    console.log(`  ➔ TCP Status: ${result.status}`);
  }
  console.log('🔍 --- END OF NETWORK DIAGNOSTICS ---\n');
};

const connectDB = async () => {
  // Run network diagnostics first
  await diagnoseConnection();

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error object details:', error);
    
    // Inspect specific server errors
    if (error.reason && error.reason.servers) {
      console.log('\n====================================================================');
      console.log('🛡️  SERVER-SPECIFIC ERRORS DETECTED BY MONGOOSE:');
      for (const [server, desc] of error.reason.servers.entries()) {
        console.log(`\nServer: ${server}`);
        if (desc.error) {
          console.log(`  ➔ Error Message: ${desc.error.message}`);
          console.log(`  ➔ Code: ${desc.error.code}`);
          console.log(`  ➔ Stack: ${desc.error.stack}`);
        } else {
          console.log(`  ➔ No error details returned by this server node.`);
        }
      }
      console.log('====================================================================\n');
    }
    
    // Fetch public IP to assist the user with MongoDB Atlas whitelisting
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      console.log('\n====================================================================');
      console.log(`👉 Your current public IP address is: ${data.ip}`);
      console.log('👉 Please ensure this IP is whitelisted in your MongoDB Atlas cluster:');
      console.log('   https://cloud.mongodb.com -> Security -> Network Access -> Add IP Address');
      console.log('====================================================================\n');
    } catch (ipError) {
      console.log('\n====================================================================');
      console.log('👉 Could not retrieve public IP address automatically.');
      console.log('👉 Please visit https://icanhazip.com to find your IP and ensure it is');
      console.log('   whitelisted in your MongoDB Atlas cluster.');
      console.log('====================================================================\n');
    }
    
    process.exit(1);
  }
};

export default connectDB;

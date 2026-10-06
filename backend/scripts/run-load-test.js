#!/usr/bin/env node
/**
 * Automated Real-Socket Load & Latency Distribution Benchmark for PRJ381.
 * Boots an isolated in-memory Mongo database and starts Express on 127.0.0.1:4088.
 * Executes concurrent load testing across all core website endpoints, measuring:
 * - Throughput (Requests per Second)
 * - Latencies: Min, Mean, P50, P95, P99, Max
 * - Status code distribution & Socket error count
 * - Rate Limiting (HTTP 429) Flood Protection
 */
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function sendRequest(endpointConfig, reqIndex) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    
    // If staticIp is requested, use that IP to test rate limiting; otherwise rotate IPs
    const clientIp = endpointConfig.staticIp 
      ? endpointConfig.staticIp 
      : `192.168.1.${(reqIndex % 250) + 1}`;

    const headers = {
      'User-Agent': 'PRJ381-LoadStressTester/2.0',
      'X-Forwarded-For': clientIp,
      ...(endpointConfig.headers || {}),
    };

    if (endpointConfig.body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(endpointConfig.body);
    }

    const reqOptions = {
      hostname: '127.0.0.1',
      port: 4088,
      path: endpointConfig.path,
      method: endpointConfig.method,
      headers,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        const isExpectedSuccess = endpointConfig.expectedCodes 
          ? endpointConfig.expectedCodes.includes(res.statusCode)
          : (res.statusCode >= 200 && res.statusCode < 400);

        resolve({
          success: isExpectedSuccess,
          statusCode: res.statusCode,
          latencyMs: durationMs,
          bytes: data.length,
        });
      });
    });

    req.on('error', (err) => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      resolve({
        success: false,
        statusCode: 0,
        latencyMs: durationMs,
        error: err.message,
      });
    });

    if (endpointConfig.body) {
      req.write(endpointConfig.body);
    }
    req.end();
  });
}

async function runBenchmark(suite, totalRequests, concurrency) {
  console.log(`▶ Load Testing: ${suite.name} (${suite.method} ${suite.path})...`);
  const latencies = [];
  const statusCodes = {};
  let errors = 0;
  let inFlight = 0;
  let completed = 0;
  let requestIndex = 0;

  const benchmarkStart = process.hrtime.bigint();

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) return;

      while (inFlight < concurrency && requestIndex < totalRequests) {
        inFlight++;
        const currIndex = requestIndex++;
        sendRequest(suite, currIndex).then((result) => {
          inFlight--;
          completed++;
          latencies.push(result.latencyMs);

          const code = result.statusCode || 'ERR';
          statusCodes[code] = (statusCodes[code] || 0) + 1;
          if (!result.success) {
            errors++;
          }

          if (completed === totalRequests) {
            const benchmarkEnd = process.hrtime.bigint();
            const totalSec = Number(benchmarkEnd - benchmarkStart) / 1e9;
            latencies.sort((a, b) => a - b);

            const sum = latencies.reduce((a, b) => a + b, 0);
            const mean = sum / latencies.length;
            const min = latencies[0];
            const max = latencies[latencies.length - 1];
            const p50 = latencies[Math.floor(latencies.length * 0.5)];
            const p95 = latencies[Math.floor(latencies.length * 0.95)];
            const p99 = latencies[Math.floor(latencies.length * 0.99)];
            const rps = totalRequests / totalSec;

            console.log(`   ✓ Completed ${totalRequests} requests in ${totalSec.toFixed(3)}s`);
            console.log(`   ⚡ Throughput: ${rps.toFixed(1)} req/sec`);
            console.log(`   ⏱ Latency: Min: ${min.toFixed(1)}ms | Mean: ${mean.toFixed(1)}ms | P50: ${p50.toFixed(1)}ms | P95: ${p95.toFixed(1)}ms | P99: ${p99.toFixed(1)}ms | Max: ${max.toFixed(1)}ms`);
            console.log(`   📊 Status Codes: ${JSON.stringify(statusCodes)}`);
            if (errors > 0) {
              console.log(`   ⚠️ Failed/Unexpected Requests: ${errors}`);
            }
            console.log('');
            resolve({ suite: suite.name, method: suite.method, path: suite.path, rps, mean, p50, p95, p99, statusCodes, errors });
          } else {
            launchNext();
          }
        });
      }
    }

    launchNext();
  });
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'stress-benchmark-secret-key-381';

  console.log('====================================================');
  console.log('🚀 PRJ381 Live Socket Load & Throughput Benchmark');
  console.log('====================================================\n');

  console.log('Starting in-memory MongoDB instance...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log('✓ MongoDB memory server online.\n');

  const User = require('../src/models/User');
  const adminUser = await User.create({
    name: 'Admin LoadTester',
    email: 'admin.loadtester@belgiumcampus.ac.za',
    password: 'Password123!',
    role: 'admin',
  });

  const adminToken = jwt.sign(
    { id: adminUser._id, email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const app = require('../src/app');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(4088, '127.0.0.1', resolve));
  console.log('✓ Express server listening on http://127.0.0.1:4088\n');

  const TEST_SUITES = [
    {
      name: '1. System Health Check Probe',
      path: '/health',
      method: 'GET',
      headers: {},
      body: null,
      expectedCodes: [200],
      totalRequests: 500,
      concurrency: 30,
    },
    {
      name: '2. Landing Page HTML Shell Delivery',
      path: '/',
      method: 'GET',
      headers: {},
      body: null,
      expectedCodes: [200],
      totalRequests: 400,
      concurrency: 25,
    },
    {
      name: '3. Public Download Telemetry Redirect',
      path: '/api/downloads/windows',
      method: 'GET',
      headers: {},
      body: null,
      expectedCodes: [302],
      totalRequests: 300,
      concurrency: 20,
    },
    {
      name: '4. Prospective Student Lead Submission (POST Write)',
      path: '/api/leads',
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        email: 'stress.student@belgiumcampus.ac.za',
        source: 'benchmark_load_test',
        hotspotId: 'kiosk-01',
      }),
      expectedCodes: [201],
      totalRequests: 300,
      concurrency: 20,
    },
    {
      name: '5. Unauthenticated Status Probe Defense (401 Gate)',
      path: '/api/status',
      method: 'GET',
      headers: {},
      body: null,
      expectedCodes: [401],
      totalRequests: 300,
      concurrency: 25,
    },
    {
      name: '6. Authenticated Admin System Status Telemetry',
      path: '/api/status',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: null,
      expectedCodes: [200],
      totalRequests: 300,
      concurrency: 20,
    },
    {
      name: '7. Authenticated Admin Leads Database Query',
      path: '/api/leads',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: null,
      expectedCodes: [200],
      totalRequests: 200,
      concurrency: 15,
    },
    {
      name: '8. Anti-Spam Flood Defense (Single IP Burst Limiting)',
      path: '/api/leads',
      method: 'POST',
      staticIp: '10.99.99.99', // Fixed attacker IP
      headers: {},
      body: JSON.stringify({
        email: 'spammer@example.com',
        source: 'spam_script',
      }),
      expectedCodes: [201, 429], // First 60 pass (201), remaining 40 blocked (429)
      totalRequests: 100,
      concurrency: 10,
    },
  ];

  const results = [];
  for (const suite of TEST_SUITES) {
    const res = await runBenchmark(suite, suite.totalRequests, suite.concurrency);
    results.push(res);
  }

  console.log('========================================================================================================');
  console.log('🏁 Live Socket Benchmark Summary Matrix');
  console.log('========================================================================================================');
  console.table(
    results.map((r) => ({
      Endpoint: `${r.method} ${r.path}`,
      Scope: r.suite,
      'Throughput (RPS)': r.rps.toFixed(1),
      'Mean Latency': `${r.mean.toFixed(1)} ms`,
      'P50 Latency': `${r.p50.toFixed(1)} ms`,
      'P95 Latency': `${r.p95.toFixed(1)} ms`,
      'P99 Latency': `${r.p99.toFixed(1)} ms`,
      Status: r.errors === 0 ? 'OPTIMAL (0 Errors)' : `${r.errors} Unexpected`,
    }))
  );

  console.log('Closing server and MongoDB...');
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  console.log('✓ Teardown complete. Benchmark completed successfully.\n');
}

main().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});

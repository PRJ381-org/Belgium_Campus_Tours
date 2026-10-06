#!/usr/bin/env node
/**
 * Tier 2 Extreme High-Concurrency Stress & Saturation Benchmark for PRJ381.
 * Tests server resilience under 50 simultaneous socket connections across:
 * - /health (1,000 requests @ 50 concurrency)
 * - / static shell (800 requests @ 50 concurrency)
 * - /api/leads concurrent writes (500 requests @ 35 concurrency)
 */
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function sendRequest(endpointConfig, reqIndex) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const headers = {
      'User-Agent': 'PRJ381-ExtremeStress/3.0',
      'X-Forwarded-For': `10.200.${Math.floor(reqIndex / 250)}.${(reqIndex % 250) + 1}`,
      ...(endpointConfig.headers || {}),
    };

    if (endpointConfig.body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(endpointConfig.body);
    }

    const reqOptions = {
      hostname: '127.0.0.1',
      port: 4099,
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
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 400,
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

async function runBenchmark(suite) {
  console.log(`▶ Extreme Load: ${suite.name} (${suite.totalRequests} reqs @ ${suite.concurrency} concurrent sockets)...`);
  const latencies = [];
  const statusCodes = {};
  let errors = 0;
  let inFlight = 0;
  let completed = 0;
  let requestIndex = 0;

  const benchmarkStart = process.hrtime.bigint();

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= suite.totalRequests) return;

      while (inFlight < suite.concurrency && requestIndex < suite.totalRequests) {
        inFlight++;
        const currIndex = requestIndex++;
        sendRequest(suite, currIndex).then((result) => {
          inFlight--;
          completed++;
          latencies.push(result.latencyMs);

          const code = result.statusCode || 'ERR';
          statusCodes[code] = (statusCodes[code] || 0) + 1;
          if (!result.success && result.statusCode !== 302) {
            errors++;
          }

          if (completed === suite.totalRequests) {
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
            const rps = suite.totalRequests / totalSec;

            console.log(`   ✓ Completed ${suite.totalRequests} requests in ${totalSec.toFixed(3)}s`);
            console.log(`   ⚡ Throughput: ${rps.toFixed(1)} req/sec`);
            console.log(`   ⏱ Latency: Min: ${min.toFixed(1)}ms | Mean: ${mean.toFixed(1)}ms | P50: ${p50.toFixed(1)}ms | P95: ${p95.toFixed(1)}ms | P99: ${p99.toFixed(1)}ms | Max: ${max.toFixed(1)}ms`);
            console.log(`   📊 Status Codes: ${JSON.stringify(statusCodes)}`);
            if (errors > 0) {
              console.log(`   ⚠️ Errors: ${errors}`);
            }
            console.log('');
            resolve({ suite: suite.name, rps, mean, p50, p95, p99, statusCodes, errors });
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
  process.env.JWT_SECRET = 'extreme-stress-benchmark-381';

  console.log('====================================================');
  console.log('🔥 PRJ381 Tier 2 Extreme Concurrency Stress Benchmark');
  console.log('====================================================\n');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log('✓ In-memory MongoDB operational.\n');

  const app = require('../src/app');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(4099, '127.0.0.1', resolve));
  console.log('✓ Express server listening on http://127.0.0.1:4099\n');

  const SUITES = [
    {
      name: 'High-Volume Health Saturation',
      path: '/health',
      method: 'GET',
      totalRequests: 1000,
      concurrency: 50,
    },
    {
      name: 'High-Volume Static Landing Page Shell',
      path: '/',
      method: 'GET',
      totalRequests: 800,
      concurrency: 50,
    },
    {
      name: 'Massive Concurrent Database Writes (POST Leads)',
      path: '/api/leads',
      method: 'POST',
      body: JSON.stringify({
        email: 'extreme.stress@belgiumcampus.ac.za',
        source: 'extreme_load_runner',
        hotspotId: 'kiosk_main',
      }),
      totalRequests: 500,
      concurrency: 35,
    },
  ];

  const results = [];
  for (const s of SUITES) {
    const res = await runBenchmark(s);
    results.push(res);
  }

  console.log('========================================================================================');
  console.log('🏁 Tier 2 Extreme Concurrency Summary');
  console.log('========================================================================================');
  console.table(
    results.map((r) => ({
      Scenario: r.suite,
      'Throughput (RPS)': r.rps.toFixed(1),
      'Mean Latency': `${r.mean.toFixed(1)} ms`,
      'P50 Latency': `${r.p50.toFixed(1)} ms`,
      'P95 Latency': `${r.p95.toFixed(1)} ms`,
      'P99 Latency': `${r.p99.toFixed(1)} ms`,
      Errors: r.errors,
    }))
  );

  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  console.log('✓ Extreme benchmark completed successfully.\n');
}

main().catch((err) => {
  console.error('Extreme benchmark failed:', err);
  process.exit(1);
});

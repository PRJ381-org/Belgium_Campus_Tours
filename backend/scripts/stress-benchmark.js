#!/usr/bin/env node
/**
 * Standalone High-Throughput Stress & Benchmark Script for PRJ381 Backend.
 *
 * Runs configurable concurrent load tests against any running server instance.
 * Measures: Throughput (RPS), Latencies (Min, Mean, P95, P99, Max), and Status Code breakdown.
 *
 * Usage:
 *   node scripts/stress-benchmark.js [baseUrl] [totalRequests] [concurrency]
 *
 * Example:
 *   node scripts/stress-benchmark.js http://localhost:4000 500 25
 */
const http = require('http');
const https = require('https');

const TARGET_URL = process.argv[2] || process.env.STRESS_TARGET || 'http://localhost:4000';
const TOTAL_REQUESTS = parseInt(process.argv[3] || '300', 10);
const CONCURRENCY = parseInt(process.argv[4] || '20', 10);

console.log('====================================================');
console.log('🚀 PRJ381 Website & Backend Stress Benchmarker');
console.log('====================================================');
console.log(`Target URL:      ${TARGET_URL}`);
console.log(`Total Requests:  ${TOTAL_REQUESTS}`);
console.log(`Concurrency:     ${CONCURRENCY}`);
console.log('====================================================\n');

const client = TARGET_URL.startsWith('https') ? https : http;
const parsedUrl = new URL(TARGET_URL);

// Endpoints to test under load
const TEST_SUITES = [
  {
    name: 'Static / Health Check (Lightweight GET)',
    path: '/health',
    method: 'GET',
    headers: {},
    body: null,
  },
  {
    name: 'Landing Page HTML Shell (Asset GET)',
    path: '/',
    method: 'GET',
    headers: {},
    body: null,
  },
  {
    name: 'Public Download Telemetry Redirect (GET)',
    path: '/api/downloads/windows',
    method: 'GET',
    headers: {},
    body: null,
  },
];

function sendRequest(endpointConfig, reqIndex) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: endpointConfig.path,
      method: endpointConfig.method,
      headers: {
        'User-Agent': 'PRJ381-StressTester/1.0',
        'X-Forwarded-For': `10.10.${Math.floor(reqIndex / 254)}.${(reqIndex % 254) + 1}`,
        ...(endpointConfig.headers || {}),
      },
    };

    const req = client.request(reqOptions, (res) => {
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
  console.log(`▶ Running benchmark: ${suite.name}...`);
  const latencies = [];
  const statusCodes = {};
  let errors = 0;
  let inFlight = 0;
  let completed = 0;
  let requestIndex = 0;

  const benchmarkStart = process.hrtime.bigint();

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= TOTAL_REQUESTS) return;

      while (inFlight < CONCURRENCY && requestIndex < TOTAL_REQUESTS) {
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

          if (completed === TOTAL_REQUESTS) {
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
            const rps = TOTAL_REQUESTS / totalSec;

            console.log(`  ✓ Completed ${TOTAL_REQUESTS} requests in ${totalSec.toFixed(2)}s`);
            console.log(`  ⚡ Throughput: ${rps.toFixed(1)} req/sec`);
            console.log(`  ⏱ Latency: Min: ${min.toFixed(1)}ms | Mean: ${mean.toFixed(1)}ms | P50: ${p50.toFixed(1)}ms | P95: ${p95.toFixed(1)}ms | P99: ${p99.toFixed(1)}ms | Max: ${max.toFixed(1)}ms`);
            console.log(`  📊 Status Codes: ${JSON.stringify(statusCodes)}`);
            if (errors > 0) {
              console.log(`  ⚠️ Failed/Error Requests: ${errors}`);
            }
            console.log('');
            resolve({ suite: suite.name, rps, mean, p95, p99, statusCodes, errors });
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
  const results = [];
  for (const suite of TEST_SUITES) {
    try {
      const res = await runBenchmark(suite);
      results.push(res);
    } catch (err) {
      console.error(`Error in suite ${suite.name}:`, err.message);
    }
  }

  console.log('====================================================');
  console.log('🏁 Stress Benchmark Summary Matrix');
  console.log('====================================================');
  console.table(
    results.map((r) => ({
      Endpoint: r.suite,
      'RPS (Throughput)': r.rps.toFixed(1),
      'Mean Latency': `${r.mean.toFixed(1)} ms`,
      'P95 Latency': `${r.p95.toFixed(1)} ms`,
      'P99 Latency': `${r.p99.toFixed(1)} ms`,
      Errors: r.errors,
    }))
  );
}

main().catch((err) => console.error('Benchmark failed:', err));

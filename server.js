// SPDX-License-Identifier: GPL-3.0-or-later
// server.js - Lightweight Preview Server for Devil-X Extension Representation

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = __dirname;
const EXTENSION_DIR = path.join(ROOT_DIR, 'ZeroScript', 'zeroscript-extension');
const ASSETS_DIR = path.join(ROOT_DIR, 'ZeroScript', 'assets');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/status') {
    return sendJSON(res, {
      connected: true,
      bridgeAddress: '127.0.0.1:17613',
      mcpAlive: true,
      studio: true,
      activeConnector: 'visual_studio',
      activeProvider: 'google_ai_studio',
      nativeHost: true,
      serverRunning: true,
    });
  }

  if (pathname === '/api/processes') {
    return sendJSON(res, {
      ok: true,
      browsers: [
        { pid: 10420, name: 'chrome.exe', title: 'Google AI Studio - Google Chrome', memory_mb: 142.5, type: 'browser', app_name: 'Google Chrome', is_source_candidate: true },
        { pid: 8912, name: 'msedge.exe', title: 'ChatGPT - Microsoft Edge', memory_mb: 98.4, type: 'browser', app_name: 'Microsoft Edge', is_source_candidate: true },
        { pid: 11200, name: 'firefox.exe', title: 'Claude.ai - Mozilla Firefox', memory_mb: 115.0, type: 'browser', app_name: 'Mozilla Firefox', is_source_candidate: true },
        { pid: 14050, name: 'brave.exe', title: 'DeepSeek Chat - Brave', memory_mb: 102.3, type: 'browser', app_name: 'Brave Browser', is_source_candidate: true },
      ],
      target_ides: [
        { pid: 15420, name: 'devenv.exe', title: 'MyUniversalSolution.sln - Microsoft Visual Studio 2022', memory_mb: 420.0, type: 'ide', connector_id: 'visual_studio', app_name: 'Microsoft Visual Studio (C# / C++)', is_target_candidate: true },
        { pid: 12040, name: 'Code.exe', title: 'ZeroScript - Visual Studio Code', memory_mb: 210.5, type: 'ide', connector_id: 'vscode', app_name: 'Visual Studio Code', is_target_candidate: true },
        { pid: 16400, name: 'Unity.exe', title: 'Unity 2022.3.14f1 - MainScene.unity', memory_mb: 850.0, type: 'ide', connector_id: 'unity', app_name: 'Unity Editor', is_target_candidate: true },
        { pid: 18200, name: 'studio64.exe', title: 'Android Studio - MobileWorkspace', memory_mb: 760.0, type: 'ide', connector_id: 'android_studio', app_name: 'Android Studio', is_target_candidate: true },
        { pid: 7344, name: 'RobloxStudioBeta.exe', title: 'Roblox Studio - Baseplate', memory_mb: 310.0, type: 'ide', connector_id: 'roblox', app_name: 'Roblox Studio', is_target_candidate: true },
      ],
    });
  }

  if (pathname === '/api/topology') {
    return sendJSON(res, {
      ok: true,
      step1: {
        name: 'Google Chrome (AI Tab)',
        pid: 10420,
        title: 'Google AI Studio - Google Chrome',
        locked: true,
      },
      step2: {
        name: 'MY SOFTWARE (Devil-X Master Hub)',
        status: 'RUNNING',
        port: 17613,
        mode: 'Master 3-Tier Controller',
      },
      step3: {
        name: 'Microsoft Visual Studio (C# / C++)',
        pid: 15420,
        title: 'MyUniversalSolution.sln - Microsoft Visual Studio 2022',
        connector_id: 'visual_studio',
        locked: true,
      },
    });
  }

  // Static file handling
  let filePath = '';
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(ROOT_DIR, 'index.html');
  } else if (pathname.startsWith('/extension/')) {
    filePath = path.join(EXTENSION_DIR, pathname.replace('/extension/', ''));
  } else if (pathname.startsWith('/assets/')) {
    filePath = path.join(ASSETS_DIR, pathname.replace('/assets/', ''));
  } else {
    const candidateRoot = path.join(ROOT_DIR, pathname);
    const candidateExt = path.join(EXTENSION_DIR, pathname);
    if (fs.existsSync(candidateRoot) && fs.statSync(candidateRoot).isFile()) {
      filePath = candidateRoot;
    } else if (fs.existsSync(candidateExt) && fs.statSync(candidateExt).isFile()) {
      filePath = candidateExt;
    } else {
      filePath = path.join(ROOT_DIR, 'index.html');
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Devil-X] Extension preview server running on http://0.0.0.0:${PORT}`);
});

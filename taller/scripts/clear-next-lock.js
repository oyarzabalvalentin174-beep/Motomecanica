const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
const portsToFree = [3000, 3001];

function freePortIfNode(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();

    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("LISTENING"));

    for (const line of lines) {
      const columns = line.split(/\s+/);
      const pid = columns[columns.length - 1];
      if (!/^\d+$/.test(pid)) continue;

      const taskInfo = execSync(`tasklist /FI "PID eq ${pid}"`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();

      if (!taskInfo.toLowerCase().includes("node.exe")) continue;

      execSync(`taskkill /PID ${pid} /F`, { stdio: ["ignore", "pipe", "pipe"] });
      console.log(`[predev] Killed stale node process ${pid} on port ${port}`);
    }
  } catch {
    // Nothing listening on this port or command unavailable.
  }
}

for (const port of portsToFree) {
  freePortIfNode(port);
}

try {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
    console.log(`[predev] Removed stale lock: ${lockPath}`);
  }
} catch (error) {
  console.warn(`[predev] Could not remove lock: ${error.message}`);
}

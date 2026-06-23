const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const nextDir = path.join(__dirname, "..", ".next");

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

const child = spawn("npx", ["next", "dev", "--turbopack"], {
  stdio: "inherit",
  shell: true,
  cwd: path.join(__dirname, ".."),
});

child.on("exit", (code) => process.exit(code ?? 0));

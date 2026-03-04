const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

// ===== CONFIG =====
const GROUP_NAME = "WhatsAppTest"; //ST3-CuringTeam  //WhatsAppTest 

const IMAGES = [
  "ST3_CP_PVSA.png",
  "ST3_User_Level_Breakdown_8.png",
].map((f) => path.join(__dirname, f));

const WAIT_AFTER_SEND_MS = 8000;
const LEAD_MINUTES = 1; // capture 1 min before send
const POST_READY_GRACE_MS = 120_000;

const PY_LAUNCHER = "py";
const PY_VERSION_ARGS = ["-3.13"];

// ===== LOCK =====
const LOCK_FILE = path.join(os.tmpdir(), "myDashboard_whatsapp.lock");
try {
  fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
} catch {
  console.error("❌ Another instance is already running.");
  process.exit(1);
}
process.on("exit", () => {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
});
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

// ===== HELPERS =====
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildCaption(label) {
  const now = new Date();
  const shift = now.getHours() >= 6 && now.getHours() < 18 ? "DAY SHIFT" : "NIGHT SHIFT";
  return `${label} - ${shift} (${now.toLocaleString()})`;
}

// ===== CHROME =====
function findChrome() {
  const paths = [
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return paths.find((p) => p && fs.existsSync(p));
}

const chromePath = findChrome();
if (!chromePath) {
  console.error("❌ Chrome not found.");
  process.exit(1);
}

// ===== AUTH =====
const AUTH_ROOT = path.join(process.env.LOCALAPPDATA || os.homedir(), "wwebjs_auth");
fs.mkdirSync(AUTH_ROOT, { recursive: true });

// ===== SCHEDULER (EVERY HOUR AT :27) =====
function getNextSendTime() {
  const now = new Date();
  const next = new Date(now);

  next.setSeconds(0, 0);
  next.setMinutes(27); // 🔥 Send at minute 27

  // If already past :27 this hour → schedule next hour
  if (next <= now) {
    next.setHours(next.getHours() + 1);
  }

  return next;
}

function scheduleLoop() {
  const sendAt = getNextSendTime();
  const captureAt = new Date(sendAt.getTime() - LEAD_MINUTES * 60 * 1000);

  console.log("🗓 Capture at:", captureAt.toLocaleTimeString());
  console.log("📤 Send at   :", sendAt.toLocaleTimeString());

  const delay = Math.max(0, captureAt.getTime() - Date.now());

  setTimeout(async () => {
    await runCycle(sendAt);
    scheduleLoop();
  }, delay);
}

// ===== WHATSAPP =====
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "myDashboard", dataPath: AUTH_ROOT }),
  puppeteer: {
    headless: false,
    executablePath: chromePath,
    args: ["--start-maximized"],
  },
  webVersionCache: { type: "none" },
});

client.on("ready", async () => {
  console.log("✅ WhatsApp ready");
  await sleep(POST_READY_GRACE_MS);
  console.log("🚀 Scheduler started (every hour at :27)");
  scheduleLoop();
});

// ===== CYCLE =====
async function runCycle(sendAt) {
  try {
    const captureAt = new Date(sendAt.getTime() - LEAD_MINUTES * 60 * 1000);

    const waitCapture = captureAt.getTime() - Date.now();
    if (waitCapture > 0) await sleep(waitCapture);

    console.log("📸 Running capture...");
    await runPythonCapture();

    for (const img of IMAGES) {
      if (!fs.existsSync(img)) throw new Error("Missing image: " + img);
    }

    const waitSend = sendAt.getTime() - Date.now();
    if (waitSend > 0) await sleep(waitSend);

    console.log("📤 Sending dashboards...");
    await sendDashboards();

  } catch (err) {
    console.error("❌ Cycle error:", err.message);
  }
}

// ===== PYTHON =====
function runPythonCapture() {
  return new Promise((resolve, reject) => {
    const p = spawn(PY_LAUNCHER, [...PY_VERSION_ARGS, "capture_dashboard.py"], {
      cwd: __dirname,
      shell: false,
      windowsHide: true,
    });

    p.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error("Python failed"));
    });
  });
}

// ===== SEND =====
async function sendDashboards() {
  const chats = await client.getChats();
  const group = chats.find((c) => c.isGroup && c.name === GROUP_NAME);
  if (!group) throw new Error("Group not found");

  for (const imgPath of IMAGES) {
    const label = path.basename(imgPath, path.extname(imgPath));
    const media = MessageMedia.fromFilePath(imgPath);

    console.log("➡ Sending:", label);

    await group.sendMessage(media, {
      caption: buildCaption(label),
    });

    await sleep(WAIT_AFTER_SEND_MS);
  }
}

client.initialize();
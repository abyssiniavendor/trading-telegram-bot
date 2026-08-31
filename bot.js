// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// PRODUCTION SCRIPT WITH CHANNEL POST FILTER & IN-APP CHECKOUT
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "abyssiniavendor";
const MONGODB_URI = process.env.MONGODB_URI;
const WEBAPP_URL = process.env.RENDER_EXTERNAL_URL || "https://trading-telegram-bot-e29v.onrender.com";

// 📢 Required Channels that users must join
const REQUIRED_CHANNELS = [
  { username: "@abyssiniatradinget", name: "Abyssinia Trading Official", url: "https://t.me/abyssiniatradinget" },
  { username: "@abyssiniachat", name: "Abyssinia Trading Chat Community", url: "https://t.me/abyssiniachat" },
  { username: "@abyssiniattstore", name: "A T T S Store Channel", url: "https://t.me/abyssiniattstore" }
];

if (!BOT_TOKEN) {
  console.error("FATAL: BOT_TOKEN is missing in environment variables!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 🛡️ Anti-Crash Error Handlers
bot.catch((err, ctx) => {
  console.error(`⚠️ Telegram Bot Error:`, err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});

// 📁 MONGOOSE DATABASE SCHEMA
const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: 'Trader' },
  tool: { type: String, required: true },
  plan: { type: String, default: 'Standard' },
  status: { type: String, default: 'Pending' }, // 'Pending' | 'Active' | 'Expired' | 'Rejected'
  price: { type: String, default: 'Paid' },
  credentials: { type: String, default: '' },
  currentWeek: { type: Number, default: 1 },
  totalWeeks: { type: Number, default: 1 },
  weeklyHistory: { type: Array, default: [] },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  referrerId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

let isMongoConnected = false;
let mongoErrorDetails = "MONGODB_URI environment variable is missing on Render";

const fallbackDb = {
  users: new Set(),
  userOrders: {},
  referrerOf: {},
  referrals: {}
};

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.log("❌ WARNING: MONGODB_URI is not set. Using temporary memory.");
    return;
  }

  try {
    console.log("⏳ Connecting to MongoDB Cloud Database...");
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });
    isMongoConnected = true;
    mongoErrorDetails = "Connected successfully!";
    console.log("✅ 🟢 SUCCESS: MongoDB Cloud Database is CONNECTED & ACTIVE!");
  } catch (err) {
    isMongoConnected = false;
    mongoErrorDetails = err.message;
    console.error("❌ 🔴 MongoDB Connection Error:", err.message);
  }
}

// Auto-expire overdue orders periodically
async function checkExpiredOrders() {
  const now = new Date();
  if (isMongoConnected) {
    try {
      await Order.updateMany(
        { status: 'Active', expiresAt: { $ne: null, $lte: now } },
        { status: 'Expired' }
      );
    } catch (e) {}
  } else {
    for (const uId in fallbackDb.userOrders) {
      fallbackDb.userOrders[uId].forEach(o => {
        if (o.status === 'Active' && o.expiresAt && o.expiresAt <= now) {
          o.status = 'Expired';
        }
      });
    }
  }
}

setInterval(checkExpiredOrders, 60 * 60 * 1000);

// DB Helpers
async function recordUser(userId, username, referrerId = null) {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      await User.findOneAndUpdate(
        { userId },
        { userId, username: username || '', ...(referrerId ? { referrerId } : {}) },
        { upsert: true, new: true }
      );
      return;
    } catch (e) {}
  }
  fallbackDb.users.add(userId);
  if (referrerId && !fallbackDb.referrerOf[userId]) {
    fallbackDb.referrerOf[userId] = referrerId;
    if (!fallbackDb.referrals[referrerId]) fallbackDb.referrals[referrerId] = [];
    fallbackDb.referrals[referrerId].push(userId);
  }
}

async function getUserOrders(userId) {
  await checkExpiredOrders();
  userId = String(userId);
  if (isMongoConnected) {
    try {
      return await Order.find({ userId }).sort({ createdAt: -1 });
    } catch (e) {}
  }
  return fallbackDb.userOrders[userId] || [];
}

async function addPendingOrder(userId, username, tool, plan, price) {
  userId = String(userId);
  const isMonthlyFxr = tool.toLowerCase().includes('fxreplay') && (plan.toLowerCase().includes('month') || tool.toLowerCase().includes('month'));
  const isTwoWeekFxr = tool.toLowerCase().includes('fxreplay') && (plan.toLowerCase().includes('two') || tool.toLowerCase().includes('2'));
  const totalWeeks = isMonthlyFxr ? 5 : (isTwoWeekFxr ? 2 : 1);

  if (isMongoConnected) {
    try {
      return await Order.create({
        userId,
        username: username || '',
        tool,
        plan,
        status: 'Pending',
        price: `${price} ETB`,
        credentials: '',
        totalWeeks: totalWeeks,
        currentWeek: 1
      });
    } catch (e) {}
  }

  if (!fallbackDb.userOrders[userId]) fallbackDb.userOrders[userId] = [];
  const tempOrd = {
    _id: Date.now().toString(),
    userId,
    tool,
    plan,
    status: 'Pending',
    price: `${price} ETB`,
    credentials: '',
    totalWeeks: totalWeeks,
    currentWeek: 1,
    weeklyHistory: []
  };
  fallbackDb.userOrders[userId].unshift(tempOrd);
  return tempOrd;
}

async function activateOrder(userId, customMessage, durationDays = null) {
  userId = String(userId);
  const expiresAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

  if (isMongoConnected) {
    try {
      let targetOrder = await Order.findOne({ userId, status: 'Pending' }).sort({ createdAt: -1 });
      if (targetOrder) {
        targetOrder.status = 'Active';
        targetOrder.credentials = customMessage;
        if (expiresAt) targetOrder.expiresAt = expiresAt;
        await targetOrder.save();
        return targetOrder;
      } else {
        return await Order.create({
          userId,
          tool: 'Trading Tool Access',
          plan: 'Standard Access',
          status: 'Active',
          price: 'Paid',
          credentials: customMessage,
          expiresAt: expiresAt
        });
      }
    } catch (e) {}
  }

  if (!fallbackDb.userOrders[userId]) fallbackDb.userOrders[userId] = [];
  const pending = fallbackDb.userOrders[userId].find(o => o.status === 'Pending');
  if (pending) {
    pending.status = 'Active';
    pending.credentials = customMessage;
    pending.expiresAt = expiresAt;
  } else {
    fallbackDb.userOrders[userId].unshift({
      _id: Date.now().toString(),
      userId,
      tool: 'Trading Tool Access',
      plan: 'Standard Access',
      status: 'Active',
      price: 'Paid',
      credentials: customMessage,
      expiresAt: expiresAt
    });
  }
}

async function updateWeeklyAccount(userId, weekNum, credentials) {
  userId = String(userId);
  weekNum = parseInt(weekNum, 10);

  if (isMongoConnected) {
    try {
      let targetOrder = await Order.findOne({ userId, status: 'Pending' }).sort({ createdAt: -1 });
      if (!targetOrder) {
        targetOrder = await Order.findOne({ userId, status: 'Active' }).sort({ createdAt: -1 });
      }

      if (targetOrder) {
        targetOrder.status = 'Active';
        targetOrder.currentWeek = weekNum;
        targetOrder.credentials = credentials;
        if (!targetOrder.weeklyHistory) targetOrder.weeklyHistory = [];
        targetOrder.weeklyHistory.push({ week: weekNum, credentials, date: new Date() });
        await targetOrder.save();
        return targetOrder;
      } else {
        return await Order.create({
          userId,
          tool: 'Fxreplay Pro Subscription',
          plan: 'Standard Plan',
          status: 'Active',
          price: 'Paid',
          currentWeek: weekNum,
          totalWeeks: 5,
          credentials: credentials,
          weeklyHistory: [{ week: weekNum, credentials, date: new Date() }]
        });
      }
    } catch (e) {}
  }

  if (!fallbackDb.userOrders[userId]) fallbackDb.userOrders[userId] = [];
  let order = fallbackDb.userOrders[userId].find(o => o.status === 'Pending') || fallbackDb.userOrders[userId].find(o => o.status === 'Active');
  if (order) {
    order.status = 'Active';
    order.currentWeek = weekNum;
    order.credentials = credentials;
    if (!order.weeklyHistory) order.weeklyHistory = [];
    order.weeklyHistory.push({ week: weekNum, credentials, date: new Date() });
  } else {
    fallbackDb.userOrders[userId].unshift({
      _id: Date.now().toString(),
      userId,
      tool: 'Fxreplay Pro Subscription',
      plan: 'Standard Plan',
      status: 'Active',
      price: 'Paid',
      currentWeek: weekNum,
      totalWeeks: 5,
      credentials: credentials,
      weeklyHistory: [{ week: weekNum, credentials, date: new Date() }]
    });
  }
}

async function expireUserOrders(userId) {
  userId = String(userId);
  let updatedCount = 0;
  if (isMongoConnected) {
    try {
      const result = await Order.updateMany(
        { userId, status: 'Active' },
        { status: 'Expired' }
      );
      updatedCount = result.modifiedCount || 0;
    } catch (e) {}
  } else if (fallbackDb.userOrders[userId]) {
    fallbackDb.userOrders[userId].forEach(o => {
      if (o.status === 'Active') {
        o.status = 'Expired';
        updatedCount++;
      }
    });
  }
  return updatedCount;
}

async function rejectPendingOrder(userId) {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      await Order.findOneAndUpdate(
        { userId, status: 'Pending' },
        { status: 'Rejected' },
        { sort: { createdAt: -1 } }
      );
    } catch (e) {}
  } else if (fallbackDb.userOrders[userId]) {
    const pending = fallbackDb.userOrders[userId].find(o => o.status === 'Pending');
    if (pending) pending.status = 'Rejected';
  }
}

const userSessions = {}; // Transient checkout session

// Payment Accounts
const PAYMENT_INFO = {
  telebirr: { number: "0938652861", name: "Berihanu" },
  binance: { id: "874067761", name: "ABYSSINIAVENDOR" }
};

// Clean Catalog
const PRODUCTS_CATALOG = {
  "tvprem_pure": { id: "tvprem_pure", title: "📊 TradingView Premium", tagline: "Top tier TradingView plan.", outOfStock: true },
  "tvprem": { id: "tvprem", title: "📊 TradingView Premium + CME Data", tagline: "Top tier with CME Data.", outOfStock: true },
  "tvess_pure": {
    id: "tvess_pure",
    title: "📈 TradingView Essential",
    tagline: "Essential charting plan with 5 indicators and 2 charts per layout.",
    plans: {
      "1m": { name: "1 Month Access", price: 1100 },
      "3m": { name: "3 Months Access", price: 2950, discountNote: "Save 350 ETB" },
      "1y": { name: "1 Year Access", price: 9500, discountNote: "Best Value" }
    }
  },
  "tvess": {
    id: "tvess",
    title: "📈 TradingView Essential + CME Data",
    tagline: "Essential charting power combined with real-time CME futures data.",
    plans: {
      "1m": { name: "1 Month Access", price: 1350 },
      "3m": { name: "3 Months Access", price: 3600, discountNote: "Save 450 ETB" },
      "1y": { name: "1 Year Access", price: 12000, discountNote: "Great Savings" }
    }
  },
  "fxr": {
    id: "fxr",
    title: "🔄 Fxreplay Pro",
    tagline: "The premier backtesting platform for Forex, Crypto & Futures traders.",
    features: [
      "True multi-timeframe backtesting engine",
      "Realistic simulated broker fills & spreads",
      "Automated Trade Analytics & Win-rate tracking",
      "Unlimited charts & historical tick replay"
    ],
    tiers: {
      "monthly": {
        name: "Monthly subscription plan",
        options: [
          { code: "fxr_m_mw", name: "Monthly + weekly subscription", price: 2000 },
          { code: "fxr_m_mw_aj", name: "Monthly + weekly + Abyssinia Journal subscription", price: 2500 },
          { code: "fxr_m_single", name: "Monthly subscription", price: 750 },
          { code: "fxr_m_notion", name: "Monthly subscription + Notion pro Journaling template", price: 850 }
        ]
      },
      "twoweeks": {
        name: "Two weeks subscription plan",
        options: [
          { code: "fxr_2w_w", name: "Two weeks + weekly subscription", price: 550 },
          { code: "fxr_2w_w_notion", name: "Two weeks + weekly subscription + Notion pro journaling template", price: 600 }
        ]
      },
      "weekly": {
        name: "Weekly subscription plan",
        options: [
          { code: "fxr_w_single", name: "Weekly subscription", price: 250 },
          { code: "fxr_w_notion", name: "Weekly subscription + Notion pro journaling template tool", price: 300 }
        ]
      }
    }
  }
};

// 📱 TELEGRAM MINI APP (WEB APP) WITH IN-APP CHECKOUT
const MINI_APP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>A T T S Store</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --success: #16a34a;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 16px; -webkit-tap-highlight-color: transparent; }
    .header { text-align: center; margin-bottom: 20px; }
    .logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-bottom: 8px; }
    .title { font-size: 20px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 16px; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .card-title { font-size: 16px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px; }
    .badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-blue { background: rgba(37,99,235,0.2); color: var(--accent); border: 1px solid rgba(56,189,248,0.3); }
    .badge-green { background: rgba(22,163,74,0.2); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }
    .badge-red { background: rgba(220,38,38,0.2); color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
    .desc { font-size: 13px; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px; }
    
    .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .btn { width: 100%; padding: 12px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; text-decoration: none; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:active { background: var(--primary-hover); transform: scale(0.98); }
    .btn-success { background: var(--success); color: #fff; }
    .btn-success:active { background: #15803d; transform: scale(0.98); }
    .btn-secondary { background: #334155; color: #fff; }
    .btn-disabled { background: #1e293b; color: #64748b; border: 1px solid #334155; cursor: not-allowed; }
    
    /* Checkout Modal / Screen */
    #checkoutView { display: none; }
    .checkout-box { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
    .pay-card { background: #0f172a; border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin: 12px 0; }
    .copy-chip { background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 6px 12px; border-radius: 8px; display: inline-block; font-family: monospace; font-size: 14px; font-weight: bold; margin: 6px 0; cursor: pointer; }
    
    .footer { text-align: center; margin-top: 24px; padding-bottom: 20px; font-size: 12px; color: var(--text-muted); }
    .footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <!-- STOREFRONT VIEW -->
  <div id="storeView">
    <div class="header">
      <div class="logo">🦅</div>
      <h1 class="title">A T T S Store</h1>
      <p class="subtitle">Official Abyssinia Trading Tools & Market Data Store</p>
    </div>

    <!-- Fxreplay Card -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">🔄 Fxreplay Pro</div>
        <span class="badge badge-green">In Stock</span>
      </div>
      <p class="desc">The #1 multi-timeframe backtesting engine with realistic spreads, automated trade logs & tick replay.</p>
      <div class="btn-grid">
        <button class="btn btn-primary" onclick="showCheckout('Fxreplay Pro (Monthly)', '750 ETB')">📅 Monthly - 750 ETB</button>
        <button class="btn btn-success" onclick="showCheckout('Fxreplay Pro (2 Weeks)', '550 ETB')">⏳ 2 Weeks - 550 ETB</button>
      </div>
      <button class="btn btn-secondary" style="margin-top: 8px;" onclick="showCheckout('Fxreplay Pro (Weekly)', '250 ETB')">⚡ Weekly Pass - 250 ETB</button>
    </div>

    <!-- TradingView Essential + CME -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📈 TV Essential + CME Data</div>
        <span class="badge badge-blue">Best Seller</span>
      </div>
      <p class="desc">Essential charting tools paired with real-time CME market data feeds for Futures & Indices.</p>
      <div class="btn-grid">
        <button class="btn btn-primary" onclick="showCheckout('TV Essential + CME (1 Month)', '1,350 ETB')">1 Month - 1,350 ETB</button>
        <button class="btn btn-success" onclick="showCheckout('TV Essential + CME (3 Months)', '3,600 ETB')">3 Months - 3,600 ETB</button>
      </div>
    </div>

    <!-- TradingView Essential Pure -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📈 TradingView Essential</div>
        <span class="badge badge-green">In Stock</span>
      </div>
      <p class="desc">Standard charting with 5 indicators per chart, unlimited saved layouts and custom timeframes.</p>
      <div class="btn-grid">
        <button class="btn btn-primary" onclick="showCheckout('TradingView Essential (1 Month)', '1,100 ETB')">1 Month - 1,100 ETB</button>
        <button class="btn btn-success" onclick="showCheckout('TradingView Essential (3 Months)', '2,950 ETB')">3 Months - 2,950 ETB</button>
      </div>
    </div>

    <!-- TradingView Premium (Out of Stock) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📊 TradingView Premium</div>
        <span class="badge badge-red">Out of Stock</span>
      </div>
      <p class="desc">25 indicators per chart, 8 charts per tab, and second-based intervals.</p>
      <button class="btn btn-disabled" disabled>🚫 Restocking Soon</button>
    </div>

    <div class="footer">
      <p>Need support? Contact <a href="https://t.me/${SUPPORT_USERNAME}">@${SUPPORT_USERNAME}</a></p>
      <p style="margin-top: 4px;">A T T S © 2026 Abyssinia Trading</p>
    </div>
  </div>

  <!-- CHECKOUT VIEW -->
  <div id="checkoutView">
    <button class="btn btn-secondary" style="margin-bottom: 16px; width: auto;" onclick="showStore()">⬅️ Back to Products</button>
    <div class="checkout-box">
      <h2 style="font-size: 18px; margin-bottom: 4px; color: #fff;">🧾 Order Checkout</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;" id="orderTitle">Package</p>
      
      <div style="font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 16px;" id="orderPrice">0 ETB</div>

      <!-- Telebirr Pay Card -->
      <div class="pay-card">
        <div style="font-weight: 600; color: #4ade80; margin-bottom: 4px;">📱 Telebirr (Mobile Money)</div>
        <p style="font-size: 12px; color: var(--text-muted);">Account Name: Berihanu</p>
        <div class="copy-chip" onclick="copyText('0938652861')">0938652861 📋 (Tap to copy)</div>
      </div>

      <!-- Binance Pay Card -->
      <div class="pay-card">
        <div style="font-weight: 600; color: #fbbf24; margin-bottom: 4px;">💎 Binance Pay (USDT)</div>
        <p style="font-size: 12px; color: var(--text-muted);">Payee Name: ABYSSINIAVENDOR</p>
        <div class="copy-chip" onclick="copyText('874067761')">874067761 📋 (Tap to copy)</div>
      </div>

      <div style="background: rgba(37,99,235,0.1); border: 1px dashed var(--primary); padding: 12px; border-radius: 10px; font-size: 12px; line-height: 1.5; color: #cbd5e1; margin-top: 16px;">
        ⚠️ <b>Next Step:</b> After completing your payment, close this window and send your screenshot receipt directly in the bot chat to receive your login credentials.
      </div>

      <button class="btn btn-primary" style="margin-top: 16px;" onclick="closeApp()">✅ Done & Send Receipt in Bot</button>
    </div>
  </div>

  <script>
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
    }

    function showCheckout(title, price) {
      document.getElementById('storeView').style.display = 'none';
      document.getElementById('checkoutView').style.display = 'block';
      document.getElementById('orderTitle').innerText = title;
      document.getElementById('orderPrice').innerText = price;
      window.scrollTo(0, 0);
    }

    function showStore() {
      document.getElementById('checkoutView').style.display = 'none';
      document.getElementById('storeView').style.display = 'block';
    }

    function copyText(text) {
      navigator.clipboard.writeText(text).then(() => {
        if (tg && tg.showPopup) {
          tg.showPopup({ message: 'Copied to clipboard: ' + text });
        } else {
          alert('Copied: ' + text);
        }
      });
    }

    function closeApp() {
      if (tg) {
        tg.close();
      }
    }
  </script>
</body>
</html>`;

// 🌐 HTTP Health Check & Web App Server
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  if (req.url === '/store' || req.url === '/webapp') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(MINI_APP_HTML);
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('A T T S Telegram Bot & Mini App Server is LIVE 24/7!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP Health Check & Web App Server listening on port ${PORT}`);
});

// ⏰ Safe Keep-Alive
if (process.env.RENDER_EXTERNAL_URL) {
  const pingUrl = process.env.RENDER_EXTERNAL_URL;
  const client = pingUrl.startsWith('https') ? https : http;
  setInterval(() => {
    client.get(pingUrl, (res) => {}).on('error', () => {});
  }, 10 * 60 * 1000);
}

// 🛡️ Middleware: Ignore Channel & Group Posts (Only handle private chats)
bot.use((ctx, next) => {
  if (ctx.channelPost || (ctx.chat && ctx.chat.type !== 'private')) {
    return; // Silently ignore channel and group messages
  }
  return next();
});

// Force Join Verification
async function checkAllChannelMemberships(ctx, userId) {
  if (String(userId) === String(ADMIN_CHAT_ID)) return { allJoined: true, missing: [] };
  const missing = [];
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const member = await ctx.telegram.getChatMember(ch.username, userId);
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);
      if (!isMember) missing.push(ch);
    } catch (err) {}
  }
  return { allJoined: missing.length === 0, missing };
}

function sendJoinChannelMessage(ctx, missingChannels) {
  const channelList = missingChannels && missingChannels.length > 0 ? missingChannels : REQUIRED_CHANNELS;
  const channelButtons = channelList.map(ch => [Markup.button.url('📢 Join ' + ch.name, ch.url)]);
  channelButtons.push([Markup.button.callback('✅ I Have Joined All Channels (Verify)', 'VERIFY_JOIN')]);

  return ctx.reply(
    "⚠️ <b>Access Required Before Using A T T S Bot!</b>\n\n" +
    "To access our premium trading tools, pricing catalogs, and instant orders, you must first join our official community channels:\n\n" +
    "1️⃣ @abyssiniatradinget (Official Channel)\n" +
    "2️⃣ @abyssiniachat (Trading Discussion Community)\n" +
    "3️⃣ @abyssiniattstore (Store & Updates)\n\n" +
    "👉 Click the buttons below to join each channel, then click Verify:",
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(channelButtons) }
  );
}

function sendMainMenu(ctx) {
  const storeUrl = `${WEBAPP_URL}/store`;

  return ctx.reply(
    "👋 <b>Welcome to A T T S - Abyssinia Trading Tools Store!</b>\n\n" +
    "Your trusted source for genuine TradingView + CME market feeds, backtesting engines, and trading analytics in Ethiopia.\n\n" +
    "Select an option below to get started:",
    {
      parse_mode: 'HTML',
      ...Markup.removeKeyboard(),
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍️ Open ATTS Storefront', storeUrl)],
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP'), Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
        [Markup.button.callback('💳 Pricing', 'ACTION_PRICING'), Markup.button.callback('🎁 Offers', 'ACTION_OFFERS')],
        [Markup.button.callback('🤝 Referral', 'ACTION_REFERRAL'), Markup.button.callback('❓ Help & FAQ', 'ACTION_FAQ')],
        [Markup.button.url('💬 Support', 'https://t.me/' + SUPPORT_USERNAME)]
      ])
    }
  );
}

function sendFAQMenu(ctx) {
  return ctx.reply(
    "❓ <b>FREQUENTLY ASKED QUESTIONS (FAQ)</b>\n\n" +
    "Click any question below for quick answers or contact our 24/7 support team:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⏱️ How Long Does Delivery Take?', 'FAQ_DELIVERY')],
        [Markup.button.callback('💳 How Do I Pay?', 'FAQ_PAYMENT')],
        [Markup.button.callback('🔒 Is This An Official Subscription?', 'FAQ_OFFICIAL')],
        [Markup.button.callback('🔄 Can I Change My Account?', 'FAQ_CHANGE_ACC')],
        [Markup.button.callback('⏰ What Happens When My Subscription Expires?', 'FAQ_EXPIRY')],
        [Markup.button.callback('🛠️ What If I Have A Problem?', 'FAQ_PROBLEM')],
        [Markup.button.callback('📞 How Do I Contact Support?', 'FAQ_SUPPORT')],
        [Markup.button.callback('🔙 Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
}

// 🩺 Database Status Diagnostic Command (/dbstatus)
bot.command('dbstatus', async (ctx) => {
  if (isMongoConnected) {
    let orderCount = 0;
    let userCount = 0;
    try {
      orderCount = await Order.countDocuments();
      userCount = await User.countDocuments();
    } catch (e) {}

    return ctx.reply(
      "🟢 <b>DATABASE STATUS: CLOUD MONGO CONNECTED!</b>\n\n" +
      "✅ <b>Storage Type:</b> Permanent MongoDB Cloud\n" +
      `📦 <b>Total Saved Orders:</b> ${orderCount}\n` +
      `👥 <b>Total Saved Users:</b> ${userCount}\n\n` +
      "🎉 <i>Your orders will NEVER be deleted even when you redeploy on Render!</i>",
      { parse_mode: 'HTML' }
    );
  } else {
    return ctx.reply(
      "🔴 <b>DATABASE STATUS: TEMPORARY MEMORY (DISCONNECTED)</b>\n\n" +
      "⚠️ <b>Why:</b> " + mongoErrorDetails,
      { parse_mode: 'HTML' }
    );
  }
});

// ⏳ Admin Expire Command (/expire <userId>)
bot.command('expire', async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('This command is restricted to the administrator only.');
    }

    const parts = ctx.message.text.trim().split(' ');
    if (parts.length < 2) {
      return ctx.reply('Usage format:\n/expire <USER_ID>\n\nExample:\n/expire 5056286354');
    }

    const targetUserId = parts[1];
    const modifiedCount = await expireUserOrders(targetUserId);

    if (modifiedCount === 0) {
      return ctx.reply(`⚠️ No active orders found for user ID: ${targetUserId}`);
    }

    try {
      await bot.telegram.sendMessage(
        targetUserId,
        "⏳ <b>Subscription Expired</b>\n\n" +
        "Your trading tool subscription has expired. We hope it assisted your trading!\n\n" +
        "To renew your subscription or choose another plan, click the shop button below:",
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🛍️ Renew / Shop Now', 'ACTION_SHOP')],
            [Markup.button.url('💬 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)]
          ])
        }
      );
    } catch (e) {}

    ctx.reply(`✅ Successfully expired active subscription for user ID: ${targetUserId}. Their access keys have been removed.`);
  } catch (err) {
    ctx.reply('Error in expire command: ' + err.message);
  }
});

// 📅 Weekly Account Delivery (/sendweek <userId> <weekNum> <credentials>)
bot.command('sendweek', async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('This command is restricted to the administrator only.');
    }

    const messageText = ctx.message.text.trim();
    const parts = messageText.split(' ');

    if (parts.length < 4) {
      return ctx.reply('Usage format:\n/sendweek <USER_ID> <WEEK_NUM> <Credentials>\n\nExample:\n/sendweek 5056286354 2 Email: fx2@trade.com | Pass: 1234');
    }

    const targetUserId = parts[1];
    const weekNum = parseInt(parts[2], 10);
    const customMessage = parts.slice(3).join(' ');

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 10) {
      return ctx.reply('Week number must be a valid number.');
    }

    const deliveryNotification = `🔄 <b>Fxreplay Weekly Account Update (Week ${weekNum})</b>\n\n` +
                                 `Your active login credentials for <b>Week ${weekNum}</b> have been updated:\n\n` +
                                 `🔐 <b>Login Details:</b>\n` +
                                 `<code>${customMessage}</code>\n\n` +
                                 `📂 <b>My Orders → 🔑 My Access</b>\n` +
                                 `🔒 Keep your credentials secure.\n\n` +
                                 `Need assistance?\n` +
                                 `📩 @` + SUPPORT_USERNAME;

    await bot.telegram.sendMessage(targetUserId, deliveryNotification, { parse_mode: 'HTML' });
    await updateWeeklyAccount(targetUserId, weekNum, customMessage);

    ctx.reply(`✅ Week ${weekNum} credentials sent and ACTIVATED for user ID: ${targetUserId}!`);
  } catch (err) {
    ctx.reply('Error in sendweek: ' + err.message);
  }
});

// 1. /start command
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const startPayload = ctx.message.text.split(' ')[1];
    let refId = null;

    if (startPayload && startPayload.startsWith('ref_')) {
      refId = startPayload.replace('ref_', '');
      if (refId !== String(userId)) {
        try {
          await bot.telegram.sendMessage(
            refId,
            "🎉 <b>New trader joined via your referral link!</b>\n\nUser: @" + (ctx.from.username || 'Trader') + "\nYou will receive a 100 ETB bonus upon their first purchase!",
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    }

    await recordUser(userId, ctx.from.username, refId);

    const { allJoined, missing } = await checkAllChannelMemberships(ctx, userId);
    if (!allJoined) return sendJoinChannelMessage(ctx, missing);

    return sendMainMenu(ctx);
  } catch (err) {
    console.error("Error in start:", err);
  }
});

bot.action('VERIFY_JOIN', async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (allJoined) {
      try { await ctx.deleteMessage(); } catch (e) {}
      ctx.reply("🎉 <b>Verification Successful!</b> Thank you for joining our community.", { parse_mode: 'HTML' });
      return sendMainMenu(ctx);
    } else {
      const remaining = missing.map(m => m.username).join(', ');
      return ctx.answerCbQuery("❌ Please join all channels first! Remaining: " + remaining, { show_alert: true });
    }
  } catch (err) {}
});

// 🛍️ 2. SHOP NOW INLINE MENU
bot.action(['ACTION_SHOP', 'ACTION_BUY'], async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (!allJoined) return sendJoinChannelMessage(ctx, missing);

    const storeUrl = `${WEBAPP_URL}/store`;

    ctx.reply(
      "🛍️ <b>A T T S Product Shop</b>\n\n" +
      "You can browse our full graphical Storefront or select directly from the menu below:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('✨ Open Full Web App Storefront', storeUrl)],
          [Markup.button.callback('📊 TradingView Premium', 'VIEW_tvprem_pure')],
          [Markup.button.callback('📊 TradingView Premium + CME Data', 'VIEW_tvprem')],
          [Markup.button.callback('📈 TradingView Essential', 'VIEW_tvess_pure')],
          [Markup.button.callback('📈 TradingView Essential + CME Data', 'VIEW_tvess')],
          [Markup.button.callback('🔄 Fxreplay Pro', 'VIEW_fxr')],
          [Markup.button.callback('📓 Abyssinia Journal', 'VIEW_abyssinia_journal')],
          [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
        ])
      }
    );
  } catch (err) {}
});

bot.action('VIEW_abyssinia_journal', (ctx) => {
  ctx.reply(
    "📓 <b>Abyssinia Journal</b>\n\n" +
    "✨ <i>Coming soon!</i>\n\n" +
    "Our automated trade journaling, risk management, and equity tracker is currently in final testing.\n\n" +
    "📢 Stay tuned on our official channel @abyssiniatradinget for the launch date!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Follow Updates in Channel', 'https://t.me/abyssiniatradinget')],
        [Markup.button.callback('🛍️ Back To Shop', 'ACTION_SHOP')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action(/^VIEW_(tvprem_pure|tvprem|tvess_pure|tvess|fxr)$/, async (ctx) => {
  try {
    const prodKey = ctx.match[1];
    const product = PRODUCTS_CATALOG[prodKey];
    if (!product) return ctx.reply("Product not found.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));

    if (product.outOfStock) {
      return ctx.reply(
        `<b>${product.title}</b>\n\n` +
        "🚫 <b>STATUS: OUT OF STOCK</b>\n\n" +
        "We are currently restocking this subscription package.\n\n" +
        "📢 Keep updated on our official channel @abyssiniatradinget for instant restock announcements!",
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('📢 Go To Official Channel', 'https://t.me/abyssiniatradinget')],
            [Markup.button.callback('🛍️ Back To Shop', 'ACTION_SHOP')],
            [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    if (prodKey === 'fxr') {
      let descText = `<b>${product.title}</b>\n` +
                     `${product.tagline}\n\n` +
                     `✨ <b>Key Features:</b>\n` +
                     product.features.map(f => `• ${f}`).join('\n') +
                     `\n\n👇 <b>Choose your subscription plan:</b>`;

      const tierButtons = [
        [Markup.button.callback('📅 Monthly subscription plan', 'FXR_TIER_monthly')],
        [Markup.button.callback('⏳ Two weeks subscription plan', 'FXR_TIER_twoweeks')],
        [Markup.button.callback('⚡ Weekly subscription plan', 'FXR_TIER_weekly')],
        [Markup.button.callback('⬅️ Back To Shop', 'ACTION_SHOP'), Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ];
      return ctx.reply(descText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(tierButtons) });
    }

    let descText = `<b>${product.title}</b>\n` +
                   `${product.tagline}\n\n` +
                   `💳 <b>Available Subscription Plans:</b>\n`;

    const planButtons = Object.keys(product.plans).map(planCode => {
      const plan = product.plans[planCode];
      const note = plan.discountNote ? " (" + plan.discountNote + ")" : "";
      return [Markup.button.callback(`👉 ${plan.name} — ${plan.price} ETB${note}`, `PLAN:${prodKey}:${planCode}`)];
    });

    planButtons.push([
      Markup.button.callback('⬅️ Back To Shop', 'ACTION_SHOP'),
      Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')
    ]);

    ctx.reply(descText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(planButtons) });
  } catch (err) {}
});

bot.action(/^FXR_TIER_(monthly|twoweeks|weekly)$/, async (ctx) => {
  try {
    const tierKey = ctx.match[1];
    const tier = PRODUCTS_CATALOG['fxr'].tiers[tierKey];

    const optionButtons = tier.options.map(opt => [
      Markup.button.callback(`👉 ${opt.name} - ${opt.price}birr`, `FXR_OPT_${opt.code}`)
    ]);

    optionButtons.push([
      Markup.button.callback('⬅️ Back to Fxreplay Plans', 'VIEW_fxr'),
      Markup.button.callback('🛍️ Shop', 'ACTION_SHOP')
    ]);

    ctx.reply(`🔄 <b>Fxreplay Pro — ${tier.name}</b>\n\nPlease select the package configuration you want:`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(optionButtons)
    });
  } catch (err) {}
});

bot.action(/^FXR_OPT_(.+)$/, async (ctx) => {
  try {
    const optCode = ctx.match[1];
    const product = PRODUCTS_CATALOG['fxr'];
    let selectedOpt = null;
    let selectedTierName = "";

    for (const tKey in product.tiers) {
      const match = product.tiers[tKey].options.find(o => o.code === optCode);
      if (match) {
        selectedOpt = match;
        selectedTierName = product.tiers[tKey].name;
        break;
      }
    }

    if (!selectedOpt) return ctx.reply("Option error.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));

    userSessions[ctx.from.id] = {
      productId: 'fxr',
      planKey: optCode,
      tool: `Fxreplay Pro - ${selectedOpt.name}`,
      planTitle: selectedTierName,
      finalPrice: selectedOpt.price
    };

    ctx.reply(
      "🧾 <b>Order Summary:</b>\n\n" +
      "📦 <b>Product:</b> Fxreplay Pro\n" +
      `📁 <b>Plan:</b> ${selectedTierName}\n` +
      `✨ <b>Package:</b> ${selectedOpt.name}\n` +
      `💰 <b>Total Payable:</b> ${selectedOpt.price} ETB\n\n` +
      "Please choose your preferred payment method below:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📱 Telebirr', 'PAY_TELEBIRR')],
          [Markup.button.callback('💎 Binance', 'PAY_BINANCE')],
          [Markup.button.callback('⬅️ Change Plan', 'VIEW_fxr')]
        ])
      }
    );
  } catch (err) {}
});

bot.action(/^PLAN:(tvprem_pure|tvprem|tvess_pure|tvess):([a-z0-9]+)$/, async (ctx) => {
  try {
    const prodKey = ctx.match[1];
    const planCode = ctx.match[2];
    const product = PRODUCTS_CATALOG[prodKey];
    if (!product || !product.plans || !product.plans[planCode]) return ctx.reply("Plan error.");

    const plan = product.plans[planCode];
    userSessions[ctx.from.id] = {
      productId: prodKey,
      planKey: planCode,
      tool: `${product.title} (${plan.name})`,
      planTitle: plan.name,
      finalPrice: plan.price
    };

    ctx.reply(
      "🧾 <b>Order Summary:</b>\n\n" +
      "📦 <b>Product:</b> " + product.title + "\n" +
      "⏱️ <b>Plan:</b> " + plan.name + "\n" +
      "💰 <b>Total Payable:</b> " + plan.price + " ETB\n\n" +
      "Please choose your preferred payment method below:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📱 Telebirr', 'PAY_TELEBIRR')],
          [Markup.button.callback('💎 Binance', 'PAY_BINANCE')],
          [Markup.button.callback('⬅️ Change Plan', "VIEW_" + prodKey)]
        ])
      }
    );
  } catch (err) {}
});

// 💳 PRICING
bot.action(['ACTION_PRICING', 'ACTION_PRICES'], (ctx) => {
  ctx.reply(
    "💳 <b>Official Pricing Overview:</b>\n\n" +
    "1. 📊 <b>TradingView Premium</b>\n   • Status: 🚫 Out of Stock\n\n" +
    "2. 📊 <b>TradingView Premium + CME Data</b>\n   • Status: 🚫 Out of Stock\n\n" +
    "3. 📈 <b>TradingView Essential</b>\n   • 1 Month: 1,100 ETB\n   • 3 Months: 2,950 ETB\n\n" +
    "4. 📈 <b>TradingView Essential + CME Data</b>\n   • 1 Month: 1,350 ETB\n   • 3 Months: 3,600 ETB\n\n" +
    "5. 🔄 <b>Fxreplay Pro</b>\n   • Monthly Plans: From 750 ETB\n   • Two Weeks Plans: From 550 ETB\n   • Weekly Plans: From 250 ETB\n\n" +
    "6. 📓 <b>Abyssinia Journal</b>\n   • Status: ✨ Coming Soon!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// 🎁 OFFERS
bot.action('ACTION_OFFERS', (ctx) => {
  ctx.reply(
    "🎁 <b>Special Season Offers:</b>\n\n" +
    "🔥 <b>TradingView Essential + CME Data</b>\nGet full real-time CME market data for only 3,600 ETB (3 Months).\n\n" +
    "🔥 <b>Fxreplay Pro Multi-Timeframe Packs</b>\nFull backtesting access starting at just 250 ETB.\n\n" +
    "🔥 <b>Abyssinia Journal Launch Special</b>\nComing soon with early bird pricing!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// 🤝 REFERRAL
bot.action('ACTION_REFERRAL', async (ctx) => {
  const userId = ctx.from.id;
  const botInfo = await ctx.telegram.getMe();
  const refLink = "https://t.me/" + botInfo.username + "?start=ref_" + userId;

  let count = 0;
  if (isMongoConnected && User) {
    try { count = await User.countDocuments({ referrerId: String(userId) }); } catch (e) {}
  } else {
    count = (fallbackDb.referrals[userId] || []).length;
  }

  ctx.reply(
    "🤝 <b>Partner & Referral Program (Invite & Earn):</b>\n\n" +
    "Invite fellow traders and earn 100 ETB Commission for every purchase they make!\n\n" +
    "📊 <b>Your Performance:</b>\n" +
    "• Traders Invited: " + count + " people\n" +
    "• Commission Balance: " + (count * 100) + " ETB\n\n" +
    "🔗 <b>Your Unique Referral Link:</b>\n" + refLink,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Share Link On Telegram', "https://t.me/share/url?url=" + encodeURIComponent(refLink) + "&text=" + encodeURIComponent('Get genuine TradingView and Fxreplay Pro in Ethiopia instantly via Telebirr & Binance on A T T S!'))],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// ❓ FAQ
bot.action('ACTION_FAQ', (ctx) => sendFAQMenu(ctx));
bot.action('FAQ_DELIVERY', (ctx) => ctx.reply("⏱️ <b>How long does delivery take?</b>\n\nOrders are delivered within 5 to 15 minutes after uploading your payment screenshot.", { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));
bot.action('FAQ_PAYMENT', (ctx) => ctx.reply("💳 <b>How do I pay?</b>\n\nWe accept Telebirr (Mobile Money) and Binance Pay.", { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));
bot.action('FAQ_OFFICIAL', (ctx) => ctx.reply("🔒 <b>Is this an official subscription?</b>\n\nYes! 100% genuine guaranteed access.", { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));
bot.action('FAQ_CHANGE_ACC', (ctx) => ctx.reply("🔄 <b>Can I change my account?</b>\n\nYes, contact @" + SUPPORT_USERNAME + " after ordering.", { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));
bot.action('FAQ_EXPIRY', (ctx) => ctx.reply("⏰ <b>What happens when my subscription expires?</b>\n\nYou will receive a reminder before expiration.", { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));
bot.action('FAQ_PROBLEM', (ctx) => ctx.reply("🛠️ <b>What if I have a problem?</b>\n\nContact support at @" + SUPPORT_USERNAME + " for fast assistance!", { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));
bot.action('FAQ_SUPPORT', (ctx) => ctx.reply("📞 <b>How do I contact support?</b>\n\nDirect Telegram: @" + SUPPORT_USERNAME, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]]) }));

// 👥 7. MY ORDERS DASHBOARD
bot.action('ACTION_MY_ORDERS', async (ctx) => {
  const userId = ctx.from.id;
  const orders = await getUserOrders(userId);
  const activeOrders = orders.filter(o => o.status === 'Active');
  const pendingOrders = orders.filter(o => o.status === 'Pending');

  ctx.reply(
    "👥 <b>My Orders Dashboard</b>\n\n" +
    "📦 <b>Overview:</b>\n" +
    `• Active Subscriptions: <b>${activeOrders.length}</b>\n` +
    `• Pending Verification: <b>${pendingOrders.length}</b>\n` +
    `• Total History: <b>${orders.length} orders</b>\n\n` +
    "Select an option below to view details:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 Active Orders', 'MY_ORDERS_ACTIVE')],
        [Markup.button.callback('🕐 Order History', 'MY_ORDERS_HISTORY')],
        [Markup.button.callback('🔑 My Access', 'MY_ORDERS_KEYS')],
        [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('MY_ORDERS_ACTIVE', async (ctx) => {
  const userId = ctx.from.id;
  const orders = await getUserOrders(userId);
  const activeOrders = orders.filter(o => o.status === 'Active');
  const pendingOrders = orders.filter(o => o.status === 'Pending');

  if (activeOrders.length === 0 && pendingOrders.length === 0) {
    return ctx.reply(
      "📦 <b>Active Orders:</b>\n\nYou do not have any active or pending subscriptions right now.",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
          [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
        ])
      }
    );
  }

  let responseText = "📦 <b>YOUR SUBSCRIPTIONS:</b>\n\n";
  if (activeOrders.length > 0) {
    responseText += "🟢 <b>ACTIVE SUBSCRIPTIONS:</b>\n";
    activeOrders.forEach((ord, i) => {
      responseText += `<b>${i + 1}. ${ord.tool}</b>\n• Status: 🟢 Active\n\n`;
    });
  }

  if (pendingOrders.length > 0) {
    responseText += "🟡 <b>PENDING VERIFICATION:</b>\n";
    pendingOrders.forEach((ord, i) => {
      responseText += `<b>${i + 1}. ${ord.tool}</b>\n• Status: 🟡 Awaiting Verification\n• Amount: ${ord.price || 'Paid'}\n\n`;
    });
  }

  responseText += "Need assistance? Contact @" + SUPPORT_USERNAME;

  ctx.reply(responseText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔑 My Access', 'MY_ORDERS_KEYS')],
      [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
    ])
  });
});

bot.action('MY_ORDERS_HISTORY', async (ctx) => {
  const userId = ctx.from.id;
  const orders = await getUserOrders(userId);

  if (orders.length === 0) {
    return ctx.reply(
      "🕐 <b>Order History:</b>\n\nNo previous order records found under your account.",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🛍️ Shop First Product', 'ACTION_SHOP')],
          [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
        ])
      }
    );
  }

  let responseText = "🕐 <b>YOUR ORDER HISTORY:</b>\n\n";
  orders.forEach((ord, idx) => {
    const icon = ord.status === 'Active' ? '🟢' : (ord.status === 'Pending' ? '🟡' : (ord.status === 'Expired' ? '⏳' : '⚪'));
    responseText += `#${idx + 1} - ${ord.tool} (${icon} ${ord.status})\n`;
  });

  ctx.reply(responseText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]])
  });
});

bot.action('MY_ORDERS_KEYS', async (ctx) => {
  const userId = ctx.from.id;
  const allOrders = await getUserOrders(userId);
  const orders = allOrders.filter(o => o.status === 'Active' && o.credentials && o.credentials.trim().length > 0);

  if (orders.length === 0) {
    return ctx.reply(
      "🔑 <b>My Access:</b>\n\nNo active login credentials available. Once your order is approved, your access keys will appear here.",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
          [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
        ])
      }
    );
  }

  let responseText = "🔑 <b>YOUR DELIVERED ACCESS CREDENTIALS:</b>\n\n";
  orders.forEach((ord, idx) => {
    responseText += `<b>${idx + 1}. ${ord.tool}</b>:\n` +
                    `<code>${ord.credentials}</code>\n\n`;
  });

  responseText += "📂 My Orders → 🔑 My Access\n" +
                  "🔒 Keep your credentials secure.\n\n" +
                  "Need assistance?\n" +
                  "📩 @" + SUPPORT_USERNAME;

  ctx.reply(responseText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('💬 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)],
      [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
    ])
  });
});

bot.action('ACTION_MAIN_MENU', (ctx) => sendMainMenu(ctx));

// 💳 Payment Details
bot.action(/PAY_(.+)/, (ctx) => {
  const method = ctx.match[1];
  const session = userSessions[ctx.from.id] || { tool: 'Trading Tool', finalPrice: 750 };
  session.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = "📱 <b>Telebirr Payment Details</b>\n\n" +
              "• Phone Number: <code>" + PAYMENT_INFO.telebirr.number + "</code> (Tap to copy)\n" +
              "• Account Name: <code>" + PAYMENT_INFO.telebirr.name + "</code>\n" +
              "• Amount: <code>" + (session.finalPrice || 750) + " ETB</code>\n\n" +
              "⚠️ <b>Important:</b> After completing the payment, please send your transaction screenshot (receipt) right here in this chat.";
  } else {
    payText = "💎 <b>Binance Payment Details</b>\n\n" +
              "• Binance Pay ID: <code>" + PAYMENT_INFO.binance.id + "</code> (Tap to copy)\n" +
              "• Payee Name: <code>" + PAYMENT_INFO.binance.name + "</code>\n" +
              "• Amount: <code>" + ((session.finalPrice || 750) / 100).toFixed(1) + " USDT</code>\n\n" +
              "⚠️ <b>Important:</b> After sending via Binance Pay, please upload your transfer screenshot or TXID here.";
  }

  ctx.reply(payText, { parse_mode: 'HTML' });
});

// Customer Uploads Receipt Photo (ONLY in Private Chat)
bot.on('photo', async (ctx) => {
  try {
    // Strict Guard: Never process channel or group posts
    if (ctx.chat.type !== 'private') return;

    const user = ctx.from;
    const session = userSessions[user.id] || { tool: 'Trading Tool Access', finalPrice: 750, method: 'Direct', planTitle: 'Standard' };
    const photo = ctx.message.photo.pop();

    await addPendingOrder(user.id, user.username, session.tool, session.planTitle, session.finalPrice);

    if (ADMIN_CHAT_ID) {
      try {
        const captionText = "🚨 <b>NEW PAYMENT RECEIPT RECEIVED!</b>\n\n" +
                            "👤 Customer: @" + (user.username || 'NoUsername') + "\n" +
                            "🆔 User ID: <code>" + user.id + "</code>\n" +
                            "📦 Product: <b>" + session.tool + "</b>\n" +
                            "💰 Amount: <b>" + (session.finalPrice || 750) + " ETB</b>\n" +
                            "💳 Method: " + (session.method || 'Direct') + "\n\n" +
                            "💡 Deliver credentials:\n" +
                            "<code>/send " + user.id + " Email: ... | Pass: ...</code>\n\n" +
                            "💡 Or with Auto-Expiry (e.g. 7d, 14d, 30d):\n" +
                            "<code>/send " + user.id + " 14d Email: ... | Pass: ...</code>\n\n" +
                            "💡 Update weekly account:\n" +
                            "<code>/sendweek " + user.id + " 2 Email: ... | Pass: ...</code>\n\n" +
                            "💡 To expire subscription anytime:\n" +
                            "<code>/expire " + user.id + "</code>";

        await bot.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
          caption: captionText,
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("Reject Receipt (" + user.id + ")", "REJECT_" + user.id)]
          ])
        });
      } catch (err) {}
    }

    ctx.reply(
      "⏳ <b>Receipt Received & Recorded!</b>\n\n" +
      "Your order has been saved under <b>👥 My Orders</b> with status 🟡 <b>Pending Verification</b>.\n\n" +
      "Our team is verifying the payment. Your login credentials will be delivered here within 5–15 minutes.",
      { parse_mode: 'HTML' }
    );
  } catch (err) {}
});

// ✍️ Admin Deliver Credentials (/send <userId> [duration] <credentials>)
bot.command('send', async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('This command is restricted to the administrator only.');
    }

    const messageText = ctx.message.text.trim();
    const parts = messageText.split(' ');

    if (parts.length < 3) {
      return ctx.reply('Usage format:\n/send <USER_ID> <Credentials>\n\nOr with days:\n/send <USER_ID> 14d <Credentials>');
    }

    const targetUserId = parts[1];
    let customMessage = '';
    let durationDays = null;

    const possibleDuration = parts[2].toLowerCase();
    if (/^\d+d$/.test(possibleDuration)) {
      durationDays = parseInt(possibleDuration.replace('d', ''), 10);
      customMessage = parts.slice(3).join(' ');
    } else {
      customMessage = parts.slice(2).join(' ');
    }

    if (!customMessage.trim()) {
      return ctx.reply('Please provide the credentials message after the user ID.');
    }

    const deliveryNotification = "✅ <b>Order Activated</b>\n\n" +
                                 "Your payment has been verified and your order is now active.\n\n" +
                                 "🔐 <b>Login Details</b>\n" +
                                 `<code>${customMessage}</code>\n\n` +
                                 "📂 <b>My Orders → 🔑 My Access</b>\n" +
                                 "🔒 Keep your credentials secure.\n\n" +
                                 "Need assistance?\n" +
                                 "📩 @" + SUPPORT_USERNAME;

    await bot.telegram.sendMessage(targetUserId, deliveryNotification, { parse_mode: 'HTML' });
    await activateOrder(targetUserId, customMessage, durationDays);

    ctx.reply(`✅ Order activated and set to ACTIVE for Customer (ID: ${targetUserId})!${durationDays ? ` (Auto-expires in ${durationDays} days)` : ''}`);
  } catch (err) {
    ctx.reply("Delivery failed: " + err.message);
  }
});

// 📢 Mass Broadcast Command (/broadcast <message>)
bot.command('broadcast', async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply('Administrator access required.');

    const text = ctx.message.text.replace('/broadcast', '').trim();
    if (!text) return ctx.reply('Please include text. Example:\n/broadcast Flash deal on Fxreplay Pro!');

    let userList = [];
    if (isMongoConnected && User) {
      const users = await User.find({}, 'userId');
      userList = users.map(u => u.userId);
    } else {
      userList = Array.from(fallbackDb.users);
    }

    ctx.reply("Sending broadcast to " + userList.length + " registered bot users...");
    let successCount = 0;

    for (const uid of userList) {
      try {
        await bot.telegram.sendMessage(uid, "📢 <b>Announcement from A T T S:</b>\n\n" + text, { parse_mode: 'HTML' });
        successCount++;
      } catch (e) {}
    }

    ctx.reply("Broadcast completed! Reached " + successCount + " traders.");
  } catch (err) {}
});

// Reject Order Callback
bot.action(/REJECT_(\d+)/, async (ctx) => {
  const targetUserId = ctx.match[1];
  try {
    await rejectPendingOrder(targetUserId);
    await bot.telegram.sendMessage(
      targetUserId,
      "❌ <b>Payment Verification Unsuccessful</b>\n\nWe could not confirm the uploaded transaction receipt. Please ensure you sent the correct screenshot or contact support at @" + SUPPORT_USERNAME,
      { parse_mode: 'HTML' }
    );
    ctx.editMessageCaption((ctx.update.callback_query.message.caption || '') + '\n\nSTATUS: REJECTED');
  } catch (err) {}
});

// 🚀 Startup Sequence
async function startApplication() {
  await connectToMongo();

  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    await bot.launch();
    console.log('🚀 A T T S Telegram Bot & Mini App is LIVE and connected!');
  } catch (err) {
    console.error('Bot launch error, retrying in 5s...', err.message);
    setTimeout(startApplication, 5000);
  }
}

startApplication();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

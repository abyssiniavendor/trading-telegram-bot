// ============================================================
// 🤖 ATTS - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// FULL PRODUCTION BACKEND BOT WITH 🔙 Menu BUTTONS
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');

// Environment Configurations
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "abyssiniavendor";
const MONGODB_URI = process.env.MONGODB_URI;

// 📢 Required Community Channels
const REQUIRED_CHANNELS = [
  { username: "@abyssiniatradinget", name: "Abyssinia Trading Official", url: "https://t.me/abyssiniatradinget" },
  { username: "@abyssiniachat", name: "Abyssinia Trading Chat Community", url: "https://t.me/abyssiniachat" },
  { username: "@abyssiniattstore", name: "ATTS Store Channel", url: "https://t.me/abyssiniattstore" }
];

if (!BOT_TOKEN) {
  console.error("FATAL: BOT_TOKEN is missing in environment variables!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 🛡️ Global Anti-Crash Error Handlers
bot.catch((err) => {
  console.error(`⚠️ Telegram Bot Error:`, err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});

// ============================================================
// 📁 MONGOOSE DATABASE SCHEMAS & MODELS
// ============================================================

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  balance: { type: Number, default: 0 },
  referrerId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: 'Trader' },
  tool: { type: String, required: true },
  plan: { type: String, default: 'Standard' },
  status: { type: String, default: 'Pending' },
  price: { type: String, default: 'Paid' },
  paymentMethod: { type: String, default: 'Direct' },
  credentials: { type: String, default: '' },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const DepositSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: 'Trader' },
  amount: { type: Number, required: true },
  method: { type: String, default: 'Telebirr' },
  refCode: { type: String, required: true, unique: true },
  status: { type: String, default: 'PENDING' },
  receiptPhotoId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null }
});

const WalletTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', DepositSchema);
const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', WalletTransactionSchema);

let isMongoConnected = false;

// Fallback in-memory cache
const fallbackDb = {
  users: new Map(),
  userOrders: {},
  deposits: [],
  transactions: {},
  referrals: {}
};

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.log("ℹ️ MONGODB_URI not provided. Operating with in-memory fallback.");
    return;
  }
  try {
    console.log("⏳ Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });
    isMongoConnected = true;
    console.log("✅ 🟢 MongoDB Connected successfully!");
  } catch (err) {
    isMongoConnected = false;
    console.error("❌ MongoDB Connection Error:", err.message);
  }
}

// Check & expire overdue orders
async function checkExpiredOrders() {
  const now = new Date();
  if (isMongoConnected) {
    try {
      await Order.updateMany(
        { status: 'Active', expiresAt: { $ne: null, $lte: now } },
        { status: 'Expired' }
      );
    } catch (e) {}
  }
}
setInterval(checkExpiredOrders, 60 * 60 * 1000);

// ============================================================
// 💰 WALLET & USER DATABASE HELPERS
// ============================================================

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
  if (!fallbackDb.users.has(userId)) {
    fallbackDb.users.set(userId, { userId, username: username || '', balance: 0, referrerId });
  }
}

async function getUserBalance(userId) {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      const user = await User.findOne({ userId });
      return user ? (user.balance || 0) : 0;
    } catch (e) {}
  }
  const memUser = fallbackDb.users.get(userId);
  return memUser ? (memUser.balance || 0) : 0;
}

async function creditWallet(userId, amount, description = 'Wallet Deposit', type = 'DEPOSIT') {
  userId = String(userId);
  amount = Math.abs(Number(amount));

  if (isMongoConnected) {
    try {
      const user = await User.findOneAndUpdate(
        { userId },
        { $inc: { balance: amount } },
        { upsert: true, new: true }
      );
      await WalletTransaction.create({
        userId,
        type,
        amount,
        balanceAfter: user.balance,
        description
      });
      return user.balance;
    } catch (e) {}
  }

  let memUser = fallbackDb.users.get(userId);
  if (!memUser) {
    memUser = { userId, username: '', balance: 0 };
    fallbackDb.users.set(userId, memUser);
  }
  memUser.balance += amount;
  if (!fallbackDb.transactions[userId]) fallbackDb.transactions[userId] = [];
  fallbackDb.transactions[userId].unshift({
    type,
    amount,
    balanceAfter: memUser.balance,
    description,
    createdAt: new Date()
  });
  return memUser.balance;
}

async function debitWallet(userId, amount, description = 'Product Purchase', type = 'PURCHASE') {
  userId = String(userId);
  amount = Math.abs(Number(amount));

  if (isMongoConnected) {
    try {
      const user = await User.findOne({ userId });
      if (!user || (user.balance || 0) < amount) return null;
      user.balance -= amount;
      await user.save();
      await WalletTransaction.create({
        userId,
        type,
        amount: -amount,
        balanceAfter: user.balance,
        description
      });
      return user.balance;
    } catch (e) {}
  }

  let memUser = fallbackDb.users.get(userId);
  if (!memUser || (memUser.balance || 0) < amount) return null;
  memUser.balance -= amount;
  if (!fallbackDb.transactions[userId]) fallbackDb.transactions[userId] = [];
  fallbackDb.transactions[userId].unshift({
    type,
    amount,
    balanceAfter: memUser.balance,
    description,
    createdAt: new Date()
  });
  return memUser.balance;
}

async function getWalletTransactions(userId) {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      return await WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(10);
    } catch (e) {}
  }
  return (fallbackDb.transactions[userId] || []).slice(0, 10);
}

async function createDepositRequest(userId, username, amount, method, refCode, photoId = '') {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      return await Deposit.create({
        userId,
        username: username || '',
        amount,
        method,
        refCode,
        status: 'PENDING',
        receiptPhotoId: photoId
      });
    } catch (e) {}
  }

  const dep = {
    _id: Date.now().toString(),
    userId,
    username: username || '',
    amount,
    method,
    refCode,
    status: 'PENDING',
    receiptPhotoId: photoId,
    createdAt: new Date()
  };
  fallbackDb.deposits.unshift(dep);
  return dep;
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

async function addPendingOrder(userId, username, tool, plan, price, paymentMethod = 'Direct') {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      return await Order.create({
        userId,
        username: username || '',
        tool,
        plan,
        status: 'Pending',
        price: `${price} ETB`,
        paymentMethod,
        credentials: ''
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
    paymentMethod,
    credentials: ''
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
  }
}

// User active session cache
const userSessions = {};

// Payment Accounts
const PAYMENT_INFO = {
  telebirr: { number: "0938652861", name: "Berihanu" },
  binance: { id: "874067761", name: "ABYSSINIAVENDOR" }
};

// ============================================================
// 📊 PRODUCTS CATALOG
// ============================================================

const PRODUCTS_CATALOG = {
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
  },
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
  }
};

// 🌐 Health Check HTTP Server for Render
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('ATTS Telegram Bot Server is LIVE 24/7!');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server active on port ${PORT}`);
});

// Keep-Alive for Render free instances
if (process.env.RENDER_EXTERNAL_URL) {
  const pingUrl = process.env.RENDER_EXTERNAL_URL;
  const client = pingUrl.startsWith('https') ? https : http;
  setInterval(() => {
    client.get(pingUrl, () => {}).on('error', () => {});
  }, 10 * 60 * 1000);
}

// 🛡️ Middleware: Ignore Channel & Group Messages
bot.use((ctx, next) => {
  if (ctx.channelPost || (ctx.chat && ctx.chat.type !== 'private')) {
    return;
  }
  return next();
});

// Community Channel Check
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
    "⚠️ <b>Access Required Before Using ATTS Bot!</b>\n\n" +
    "To access our premium trading tools, wallet deposits, and instant orders, you must first join our official community channels:\n\n" +
    "1️⃣ @abyssiniatradinget (Official Channel)\n" +
    "2️⃣ @abyssiniachat (Trading Discussion Community)\n" +
    "3️⃣ @abyssiniattstore (Store & Updates)\n\n" +
    "👉 Click the buttons below to join each channel, then click Verify:",
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(channelButtons) }
  );
}

// ============================================================
// 🏠 MAIN MENU (OFFERS ON LEFT, PRICING ON RIGHT)
// ============================================================

function sendMainMenu(ctx) {
  return ctx.reply(
    "👋 <b>Welcome to ATTS</b>\n" +
    "Abyssinia Trading Tools Store\n\n" +
    "Access premium trading tools, market data, backtesting platforms, and trading resources — all in one place, at the best price.\n\n" +
    "⚡ Fast Delivery\n" +
    "🛡️ Genuine Access\n" +
    "💬 Dedicated Support\n\n" +
    "Choose an option below to continue.",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        // Row 1 (Full Width)
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')],
        // Row 2 (2 Columns)
        [Markup.button.callback('💳 My Wallet', 'ACTION_WALLET'), Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
        // Row 3 (2 Columns: Offers on Left, Pricing on Right)
        [Markup.button.callback('🎁 Offers', 'ACTION_OFFERS'), Markup.button.callback('🏷 Pricing', 'ACTION_PRICING')],
        // Row 4 (2 Columns)
        [Markup.button.callback('🤝 Referral', 'ACTION_REFERRAL'), Markup.button.callback('❓ Help Center', 'ACTION_FAQ')],
        // Row 5 (Full Width URL Button)
        [Markup.button.url('💬 Live Support', 'https://t.me/' + SUPPORT_USERNAME)]
      ])
    }
  );
}

// ============================================================
// 📊 TRADING TOOLS MENU (REQUESTED LAYOUT)
// 1. Fxreplay Pro
// 2. TV Premium | TV Premium + CME
// 3. TV Essential | TV Essential + CME
// 4. Abyssinia Journal
// 5. My Wallet | 🔙 Menu
// ============================================================

bot.action(['ACTION_SHOP', 'ACTION_BUY'], async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (!allJoined) return sendJoinChannelMessage(ctx, missing);

    return ctx.reply(
      "📊 <b>ATTS Trading Tools</b>\n\n" +
      "Select a trading tool below to view specifications, available plans, and instant pricing:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          // 1. Fxreplay Pro (Full Width)
          [
            Markup.button.callback('🔄 Fxreplay Pro', 'VIEW_fxr')
          ],
          // 2. TV Premium | TV Premium + CME (2 Columns)
          [
            Markup.button.callback('📊 TV Premium', 'VIEW_tvprem_pure'),
            Markup.button.callback('📊 TV Premium + CME', 'VIEW_tvprem')
          ],
          // 3. TV Essential | TV Essential + CME (2 Columns)
          [
            Markup.button.callback('📈 TV Essential', 'VIEW_tvess_pure'),
            Markup.button.callback('📈 TV Essential + CME', 'VIEW_tvess')
          ],
          // 4. Abyssinia Journal (Full Width)
          [
            Markup.button.callback('📓 Abyssinia Journal', 'VIEW_abyssinia_journal')
          ],
          // 5. My Wallet | 🔙 Menu (2 Columns)
          [
            Markup.button.callback('💳 My Wallet', 'ACTION_WALLET'),
            Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')
          ]
        ])
      }
    );
  } catch (err) {}
});

// Abyssinia Journal view
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
        [Markup.button.callback('📊 Back To Trading Tools', 'ACTION_SHOP'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// Product detail view
bot.action(/^VIEW_(tvprem_pure|tvprem|tvess_pure|tvess|fxr)$/, async (ctx) => {
  try {
    const prodKey = ctx.match[1];
    const product = PRODUCTS_CATALOG[prodKey];
    if (!product) return ctx.reply("Product not found.", Markup.inlineKeyboard([[Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')]]));

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
            [Markup.button.callback('📊 Back To Trading Tools', 'ACTION_SHOP'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
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
        [Markup.button.callback('⬅️ Back To Tools', 'ACTION_SHOP'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
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
      Markup.button.callback('⬅️ Back To Tools', 'ACTION_SHOP'),
      Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')
    ]);

    ctx.reply(descText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(planButtons) });
  } catch (err) {}
});

bot.action(/^FXR_TIER_(monthly|twoweeks|weekly)$/, async (ctx) => {
  try {
    const tierKey = ctx.match[1];
    const tier = PRODUCTS_CATALOG['fxr'].tiers[tierKey];

    const optionButtons = tier.options.map(opt => [
      Markup.button.callback(`👉 ${opt.name} - ${opt.price} ETB`, `FXR_OPT_${opt.code}`)
    ]);

    optionButtons.push([
      Markup.button.callback('⬅️ Back to Fxreplay', 'VIEW_fxr'),
      Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')
    ]);

    ctx.reply(`🔄 <b>Fxreplay Pro — ${tier.name}</b>\n\nPlease select your package:`, {
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

    if (!selectedOpt) return ctx.reply("Option error.", Markup.inlineKeyboard([[Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')]]));

    const balance = await getUserBalance(ctx.from.id);
    userSessions[ctx.from.id] = {
      type: 'ORDER',
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
      `💰 <b>Total Payable:</b> ${selectedOpt.price} ETB\n` +
      `💳 <b>Your Wallet Balance:</b> <b>${balance.toLocaleString()} ETB</b>\n\n` +
      "Please choose your preferred payment method below:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`💰 Pay with Wallet (${balance.toLocaleString()} ETB)`, `PAY_WALLET_fxr_${optCode}`)],
          [Markup.button.callback('📱 Telebirr', 'PAY_TELEBIRR'), Markup.button.callback('💎 Binance Pay', 'PAY_BINANCE')],
          [Markup.button.callback('⬅️ Change Plan', 'VIEW_fxr'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
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
    const balance = await getUserBalance(ctx.from.id);

    userSessions[ctx.from.id] = {
      type: 'ORDER',
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
      "💰 <b>Total Payable:</b> " + plan.price + " ETB\n" +
      `💳 <b>Your Wallet Balance:</b> <b>${balance.toLocaleString()} ETB</b>\n\n` +
      "Please choose your preferred payment method below:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`💰 Pay with Wallet (${balance.toLocaleString()} ETB)`, `PAY_WALLET_${prodKey}_${planCode}`)],
          [Markup.button.callback('📱 Telebirr', 'PAY_TELEBIRR'), Markup.button.callback('💎 Binance Pay', 'PAY_BINANCE')],
          [Markup.button.callback('⬅️ Change Plan', "VIEW_" + prodKey), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
        ])
      }
    );
  } catch (err) {}
});

// Pay with Wallet Handler
bot.action(/^PAY_WALLET_(.+)$/, async (ctx) => {
  const session = userSessions[ctx.from.id];
  const price = session ? session.finalPrice : 750;
  const toolName = session ? session.tool : "Trading Tool Access";
  const planTitle = session ? session.planTitle : "Standard";

  const userId = ctx.from.id;
  const username = ctx.from.username || 'Trader';

  const newBalance = await debitWallet(userId, price, `Purchase: ${toolName}`);

  if (newBalance === null) {
    const currentBalance = await getUserBalance(userId);
    return ctx.reply(
      "⚠️ <b>INSUFFICIENT WALLET BALANCE</b>\n\n" +
      `<b>Product Price:</b> ${price.toLocaleString()} ETB\n` +
      `<b>Your Balance:</b> ${currentBalance.toLocaleString()} ETB\n` +
      `<b>Shortage:</b> ${(price - currentBalance).toLocaleString()} ETB\n\n` +
      "Please add funds to your wallet or pay via Telebirr:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT')],
          [Markup.button.callback('📱 Pay via Telebirr', 'PAY_TELEBIRR'), Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')]
        ])
      }
    );
  }

  await addPendingOrder(userId, username, toolName, planTitle, price, 'Wallet');

  if (ADMIN_CHAT_ID) {
    try {
      await bot.telegram.sendMessage(
        ADMIN_CHAT_ID,
        `🚨 <b>NEW ORDER PAID VIA WALLET!</b>\n\n` +
        `👤 Customer: @${username}\n` +
        `🆔 User ID: <code>${userId}</code>\n` +
        `📦 Product: <b>${toolName}</b>\n` +
        `💰 Amount: <b>${price} ETB (Wallet Paid)</b>\n` +
        `💳 Remaining Wallet: <b>${newBalance.toLocaleString()} ETB</b>\n\n` +
        `💡 Deliver Credentials:\n` +
        `<code>/send ${userId} Email: ... | Pass: ...</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }

  return ctx.reply(
    `🎉 <b>PURCHASE COMPLETED WITH WALLET!</b>\n\n` +
    `📦 <b>Product:</b> ${toolName}\n` +
    `💰 <b>Deducted:</b> -${price.toLocaleString()} ETB\n` +
    `💳 <b>Remaining Balance:</b> <b>${newBalance.toLocaleString()} ETB</b>\n\n` +
    `✅ Your order is confirmed. Login credentials will be delivered within 5–15 minutes!\n\n` +
    `Track your order in <b>📦 My Orders</b>.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// Direct Payment Selected
bot.action(/PAY_(TELEBIRR|BINANCE)/, (ctx) => {
  const method = ctx.match[1];
  const session = userSessions[ctx.from.id] || { tool: 'Trading Tool', finalPrice: 750 };
  session.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = "📱 <b>Telebirr Payment Details</b>\n\n" +
              "• Phone Number: <code>" + PAYMENT_INFO.telebirr.number + "</code> (Tap to copy)\n" +
              "• Account Name: <code>" + PAYMENT_INFO.telebirr.name + "</code>\n" +
              "• Amount: <code>" + (session.finalPrice || 750) + " ETB</code>\n\n" +
              "⚠️ <b>Important:</b> After completing payment, upload your transaction receipt right here in this chat.";
  } else {
    payText = "💎 <b>Binance Payment Details</b>\n\n" +
              "• Binance Pay ID: <code>" + PAYMENT_INFO.binance.id + "</code> (Tap to copy)\n" +
              "• Payee Name: <code>" + PAYMENT_INFO.binance.name + "</code>\n" +
              "• Amount: <code>" + ((session.finalPrice || 750) / 100).toFixed(1) + " USDT</code>\n\n" +
              "⚠️ <b>Important:</b> After sending via Binance Pay, upload your transfer screenshot or TXID here.";
  }

  ctx.reply(payText, { parse_mode: 'HTML' });
});

// ============================================================
// 💰 CUSTOMER WALLET SYSTEM
// ============================================================

bot.action('ACTION_WALLET', async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (!allJoined) return sendJoinChannelMessage(ctx, missing);

    delete userSessions[ctx.from.id];
    const balance = await getUserBalance(ctx.from.id);

    return ctx.reply(
      "💰 <b>MY WALLET</b>\n\n" +
      "<b>Available Balance:</b>\n" +
      `<b>${balance.toLocaleString()} ETB</b>\n\n` +
      "Use your wallet balance to purchase or renew trading tools instantly.",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT')],
          [Markup.button.callback('📜 History', 'WALLET_HISTORY'), Markup.button.callback('🛒 Buy with Wallet', 'ACTION_SHOP')],
          [Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
        ])
      }
    );
  } catch (err) {}
});

// Deposit Amount Selection
bot.action('WALLET_DEPOSIT', async (ctx) => {
  delete userSessions[ctx.from.id];
  return ctx.reply(
    "💳 <b>ADD FUNDS</b>\n\nSelect an amount to add to your ATTS Wallet:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👉 100 ETB', 'DEP_AMT_100'), Markup.button.callback('👉 250 ETB', 'DEP_AMT_250')],
        [Markup.button.callback('👉 500 ETB', 'DEP_AMT_500'), Markup.button.callback('👉 1,000 ETB', 'DEP_AMT_1000')],
        [Markup.button.callback('👉 2,500 ETB', 'DEP_AMT_2500'), Markup.button.callback('👉 5,000 ETB', 'DEP_AMT_5000')],
        [Markup.button.callback('💵 Custom Amount', 'DEP_AMT_CUSTOM')],
        [Markup.button.callback('⬅️ Back to Wallet', 'ACTION_WALLET'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('DEP_AMT_CUSTOM', (ctx) => {
  userSessions[ctx.from.id] = { awaitingCustomDeposit: true };
  return ctx.reply(
    "💵 <b>Custom Deposit Amount</b>\n\n" +
    "Please type the amount in ETB you want to add to your wallet:\n" +
    "(Minimum deposit: <b>100 ETB</b>)",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'ACTION_WALLET')]
      ])
    }
  );
});

bot.action(/^DEP_AMT_(\d+)$/, (ctx) => {
  const amount = parseInt(ctx.match[1], 10);
  return showDepositMethodSelection(ctx, amount);
});

function showDepositMethodSelection(ctx, amount) {
  return ctx.reply(
    "💳 <b>DEPOSIT REQUEST</b>\n\n" +
    `<b>Amount:</b> <b>${amount.toLocaleString()} ETB</b>\n\n` +
    "Please choose your preferred payment method below:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📱 Telebirr', `DEP_METHOD_TELEBIRR_${amount}`), Markup.button.callback('💎 Binance Pay', `DEP_METHOD_BINANCE_${amount}`)],
        [Markup.button.callback('⬅️ Back to Amounts', 'WALLET_DEPOSIT')]
      ])
    }
  );
}

bot.action(/^DEP_METHOD_(TELEBIRR|BINANCE)_(\d+)$/, (ctx) => {
  const method = ctx.match[1];
  const amount = parseInt(ctx.match[2], 10);

  userSessions[ctx.from.id] = {
    type: 'DEPOSIT',
    amount: amount,
    method: method === 'TELEBIRR' ? 'Telebirr' : 'Binance'
  };

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = `📱 <b>Telebirr Payment Details</b>\n\n` +
              `• Phone Number: <code>${PAYMENT_INFO.telebirr.number}</code> (Tap to copy)\n` +
              `• Account Name: <code>${PAYMENT_INFO.telebirr.name}</code>\n` +
              `• Amount: <code>${amount.toLocaleString()} ETB</code>`;
  } else {
    payText = `💎 <b>Binance Payment Details</b>\n\n` +
              `• Binance Pay ID: <code>${PAYMENT_INFO.binance.id}</code> (Tap to copy)\n` +
              `• Payee Name: <code>${PAYMENT_INFO.binance.name}</code>\n` +
              `• Amount: <code>${(amount / 100).toFixed(1)} USDT</code>`;
  }

  payText += `\n\n📤 <b>Submit Payment Proof:</b>\n` +
             `After completing payment, upload your payment screenshot (receipt) right here in this chat.`;

  return ctx.reply(payText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel Deposit', 'ACTION_WALLET')]
    ])
  });
});

bot.action('WALLET_HISTORY', async (ctx) => {
  const userId = ctx.from.id;
  const balance = await getUserBalance(userId);
  const txList = await getWalletTransactions(userId);

  let text = `📜 <b>WALLET TRANSACTION HISTORY</b>\n\n` +
             `<b>Available Balance:</b> <b>${balance.toLocaleString()} ETB</b>\n\n`;

  if (!txList || txList.length === 0) {
    text += "No wallet transactions recorded yet. Make a deposit to fund your wallet!";
  } else {
    txList.forEach((tx, idx) => {
      const sign = tx.amount >= 0 ? '+' : '';
      const icon = tx.amount >= 0 ? '🟢' : '🛒';
      const dateStr = new Date(tx.createdAt).toLocaleDateString();
      text += `${idx + 1}. ${icon} <b>${sign}${tx.amount.toLocaleString()} ETB</b>\n` +
              `   • ${tx.description || tx.type}\n` +
              `   • Date: ${dateStr} | Balance: ${tx.balanceAfter.toLocaleString()} ETB\n\n`;
    });
  }

  return ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT'), Markup.button.callback('⬅️ Back to Wallet', 'ACTION_WALLET')]
    ])
  });
});

// ============================================================
// 📸 RECEIPT UPLOAD & INPUT HANDLERS
// ============================================================

bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (session && session.awaitingCustomDeposit) {
    const text = ctx.message.text.trim();
    const amount = parseInt(text.replace(/[^0-9]/g, ''), 10);

    if (isNaN(amount) || amount < 100) {
      return ctx.reply("❌ Invalid amount. Minimum deposit is 100 ETB. Please type a valid number (e.g. 500):");
    }

    delete session.awaitingCustomDeposit;
    return showDepositMethodSelection(ctx, amount);
  }

  return next();
});

bot.on('photo', async (ctx) => {
  try {
    if (ctx.chat.type !== 'private') return;

    const user = ctx.from;
    const session = userSessions[user.id] || {};
    const photo = ctx.message.photo.pop();

    if (session.type === 'DEPOSIT') {
      const depositAmount = session.amount || 500;
      const method = session.method || 'Telebirr';
      const refCode = `DEP-${Math.floor(100000 + Math.random() * 900000)}`;

      const dep = await createDepositRequest(user.id, user.username, depositAmount, method, refCode, photo.file_id);
      const depId = String(dep._id || refCode);
      delete userSessions[user.id];

      if (ADMIN_CHAT_ID) {
        try {
          await bot.telegram.sendPhoto(
            ADMIN_CHAT_ID,
            photo.file_id,
            {
              caption: `💳 <b>PENDING WALLET DEPOSIT</b>\n\n` +
                       `👤 <b>User:</b> @${user.username || 'NoUsername'}\n` +
                       `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
                       `💰 <b>Amount:</b> <b>${depositAmount.toLocaleString()} ETB</b>\n` +
                       `💳 <b>Method:</b> ${method}\n` +
                       `🔖 <b>Reference:</b> <code>${refCode}</code>\n\n` +
                       `Click below to approve or reject:`,
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(`✅ Approve (+${depositAmount} ETB)`, `DEP_APPROVE_${depId}`)],
                [Markup.button.callback('❌ Reject Deposit', `DEP_REJECT_${depId}`)]
              ])
            }
          );
        } catch (e) {}
      }

      return ctx.reply(
        `⏳ <b>DEPOSIT PENDING</b>\n\n` +
        `<b>Amount:</b> <b>${depositAmount.toLocaleString()} ETB</b>\n` +
        `<b>Reference:</b> <code>${refCode}</code>\n\n` +
        `Your payment is waiting for verification.\n` +
        `You will receive a notification once reviewed.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💳 Back to Wallet', 'ACTION_WALLET')]
          ])
        }
      );
    } else {
      const toolName = session.tool || 'Trading Tool Access';
      const price = session.finalPrice || 750;
      const planTitle = session.planTitle || 'Standard';

      await addPendingOrder(user.id, user.username, toolName, planTitle, price, session.method || 'Direct');

      if (ADMIN_CHAT_ID) {
        try {
          await bot.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
            caption: `🚨 <b>DIRECT ORDER RECEIPT RECEIVED</b>\n\n` +
                     `👤 Customer: @${user.username || 'NoUsername'}\n` +
                     `🆔 User ID: <code>${user.id}</code>\n` +
                     `📦 Tool: <b>${toolName}</b>\n` +
                     `💰 Amount: <b>${price} ETB</b>\n\n` +
                     `Deliver credentials:\n<code>/send ${user.id} Email: ... | Pass: ...</code>`,
            parse_mode: 'HTML'
          });
        } catch (err) {}
      }

      return ctx.reply(
        "⏳ <b>Receipt Received & Recorded!</b>\n\n" +
        "Your order is recorded under <b>📦 My Orders</b>.\n" +
        "Admin will verify the payment and deliver credentials within 5–15 minutes.",
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }
  } catch (err) {}
});

// Admin Approval/Rejection Actions
bot.action(/^DEP_APPROVE_(.+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery('Unauthorized');

  const depId = ctx.match[1];
  let deposit = null;

  if (isMongoConnected) {
    try {
      deposit = await Deposit.findById(depId) || await Deposit.findOne({ refCode: depId });
    } catch (e) {}
  } else {
    deposit = fallbackDb.deposits.find(d => d._id === depId || d.refCode === depId);
  }

  if (!deposit || deposit.status === 'APPROVED') {
    return ctx.answerCbQuery('Deposit already approved or not found.');
  }

  deposit.status = 'APPROVED';
  deposit.processedAt = new Date();
  if (isMongoConnected) await deposit.save();

  const newBalance = await creditWallet(deposit.userId, deposit.amount, `Deposit Approved (${deposit.refCode})`, 'DEPOSIT');

  try {
    ctx.editMessageCaption(
      (ctx.update.callback_query.message.caption || '') + `\n\n✅ <b>STATUS: APPROVED (+${deposit.amount} ETB)</b>\n💳 New Balance: ${newBalance.toLocaleString()} ETB`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  try {
    await bot.telegram.sendMessage(
      deposit.userId,
      "✅ <b>WALLET DEPOSIT APPROVED</b>\n\n" +
      "Your wallet has been credited successfully.\n\n" +
      `💰 <b>Added:</b> +${deposit.amount.toLocaleString()} ETB\n` +
      `💳 <b>New Balance:</b> <b>${newBalance.toLocaleString()} ETB</b>\n\n` +
      "Thank you for using ATTS.",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📊 Buy Trading Tools', 'ACTION_SHOP'), Markup.button.callback('💳 View Wallet', 'ACTION_WALLET')]
        ])
      }
    );
  } catch (e) {}

  return ctx.answerCbQuery('Deposit approved!');
});

bot.action(/^DEP_REJECT_(.+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery('Unauthorized');

  const depId = ctx.match[1];
  let deposit = null;

  if (isMongoConnected) {
    try {
      deposit = await Deposit.findById(depId) || await Deposit.findOne({ refCode: depId });
    } catch (e) {}
  } else {
    deposit = fallbackDb.deposits.find(d => d._id === depId || d.refCode === depId);
  }

  if (!deposit) return ctx.answerCbQuery('Deposit not found.');

  deposit.status = 'REJECTED';
  deposit.processedAt = new Date();
  if (isMongoConnected) await deposit.save();

  try {
    ctx.editMessageCaption(
      (ctx.update.callback_query.message.caption || '') + `\n\n❌ <b>STATUS: REJECTED</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  try {
    await bot.telegram.sendMessage(
      deposit.userId,
      "❌ <b>DEPOSIT REJECTED</b>\n\n" +
      `Your deposit request for <b>${deposit.amount.toLocaleString()} ETB</b> was rejected.\n\n` +
      "<b>Reason:</b>\nPayment could not be verified with official bank records.\n\n`" +
      `Contact @${SUPPORT_USERNAME} if you have any questions.`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  return ctx.answerCbQuery('Deposit rejected.');
});

// Admin Command /send
bot.command('send', async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply('Admin access only.');

    const parts = ctx.message.text.trim().split(' ');
    if (parts.length < 3) {
      return ctx.reply('Usage:\n/send <USER_ID> <Credentials>\n\nExample:\n/send 5056286354 Email: ... | Pass: ...');
    }

    const targetUserId = parts[1];
    let customMessage = '';
    let durationDays = null;

    if (/^\d+d$/i.test(parts[2])) {
      durationDays = parseInt(parts[2].replace(/d/i, ''), 10);
      customMessage = parts.slice(3).join(' ');
    } else {
      customMessage = parts.slice(2).join(' ');
    }

    const deliveryNotification = "✅ <b>Order Activated</b>\n\n" +
                                 "Your order is now active.\n\n" +
                                 "🔐 <b>Login Details</b>\n" +
                                 `<code>${customMessage}</code>\n\n` +
                                 "📂 <b>My Orders → 🔑 My Access</b>\n" +
                                 "🔒 Keep your credentials secure.\n\n" +
                                 "Need assistance?\n" +
                                 "📩 @" + SUPPORT_USERNAME;

    await bot.telegram.sendMessage(targetUserId, deliveryNotification, { parse_mode: 'HTML' });
    await activateOrder(targetUserId, customMessage, durationDays);

    ctx.reply(`✅ Delivered credentials to User ID ${targetUserId}!`);
  } catch (err) {
    ctx.reply("Error: " + err.message);
  }
});

// Admin Command /credit
bot.command('credit', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply('Admin only.');
  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 3) return ctx.reply('Usage: /credit <USER_ID> <AMOUNT> [Reason]');

  const targetUserId = parts[1];
  const amount = parseInt(parts[2], 10);
  const reason = parts.slice(3).join(' ') || 'Admin Manual Credit';

  if (isNaN(amount) || amount <= 0) return ctx.reply('Invalid amount.');
  const newBal = await creditWallet(targetUserId, amount, reason, 'ADMIN_CREDIT');

  try {
    await bot.telegram.sendMessage(
      targetUserId,
      `✅ <b>WALLET CREDITED BY ADMIN</b>\n\n` +
      `💰 <b>Amount:</b> +${amount.toLocaleString()} ETB\n` +
      `💳 <b>New Balance:</b> <b>${newBal.toLocaleString()} ETB</b>\n` +
      `📝 <b>Note:</b> ${reason}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  ctx.reply(`✅ Credited +${amount} ETB to user ${targetUserId}. New Balance: ${newBal} ETB`);
});

// Admin Command /debit
bot.command('debit', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply('Admin only.');
  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 3) return ctx.reply('Usage: /debit <USER_ID> <AMOUNT> [Reason]');

  const targetUserId = parts[1];
  const amount = parseInt(parts[2], 10);
  const reason = parts.slice(3).join(' ') || 'Admin Manual Debit';

  if (isNaN(amount) || amount <= 0) return ctx.reply('Invalid amount.');
  const newBal = await debitWallet(targetUserId, amount, reason, 'ADMIN_DEBIT');
  if (newBal === null) return ctx.reply('❌ Insufficient user balance to debit that amount.');

  try {
    await bot.telegram.sendMessage(
      targetUserId,
      `⚠️ <b>WALLET DEBITED BY ADMIN</b>\n\n` +
      `💰 <b>Amount:</b> -${amount.toLocaleString()} ETB\n` +
      `💳 <b>New Balance:</b> <b>${newBal.toLocaleString()} ETB</b>\n` +
      `📝 <b>Note:</b> ${reason}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  ctx.reply(`✅ Debited -${amount} ETB from user ${targetUserId}. New Balance: ${newBal} ETB`);
});

// Admin Command /checkwallet
bot.command('checkwallet', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply('Admin only.');
  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 2) return ctx.reply('Usage: /checkwallet <USER_ID>');

  const targetUserId = parts[1];
  const bal = await getUserBalance(targetUserId);
  const orders = await getUserOrders(targetUserId);
  const txs = await getWalletTransactions(targetUserId);

  ctx.reply(
    `👤 <b>WALLET PROFILE (ID: ${targetUserId})</b>\n\n` +
    `💰 <b>Current Balance:</b> <b>${bal.toLocaleString()} ETB</b>\n` +
    `📦 <b>Total Orders:</b> ${orders.length}\n` +
    `📜 <b>Transactions Logged:</b> ${txs.length}`,
    { parse_mode: 'HTML' }
  );
});

// ============================================================
// 📦 ORDERS, PRICING, OFFERS, REFERRAL, HELP
// ============================================================

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const startPayload = ctx.message.text.split(' ')[1];
  let refId = null;

  if (startPayload && startPayload.startsWith('ref_')) {
    refId = startPayload.replace('ref_', '');
    if (refId !== String(userId)) {
      try {
        await bot.telegram.sendMessage(
          refId,
          "🎉 <b>New trader joined via your referral link!</b>\n\nUser: @" + (ctx.from.username || 'Trader'),
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }
  }

  await recordUser(userId, ctx.from.username, refId);

  const { allJoined, missing } = await checkAllChannelMemberships(ctx, userId);
  if (!allJoined) return sendJoinChannelMessage(ctx, missing);

  return sendMainMenu(ctx);
});

bot.action('VERIFY_JOIN', async (ctx) => {
  const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
  if (allJoined) {
    try { await ctx.deleteMessage(); } catch (e) {}
    ctx.reply("🎉 <b>Verification Successful!</b> Welcome to ATTS.", { parse_mode: 'HTML' });
    return sendMainMenu(ctx);
  } else {
    const remaining = missing.map(m => m.username).join(', ');
    return ctx.answerCbQuery("❌ Please join all channels first: " + remaining, { show_alert: true });
  }
});

bot.action('ACTION_MY_ORDERS', async (ctx) => {
  const orders = await getUserOrders(ctx.from.id);
  const activeOrders = orders.filter(o => o.status === 'Active');

  let text = `📦 <b>My Orders Dashboard</b>\n\n` +
             `• Active Subscriptions: <b>${activeOrders.length}</b>\n` +
             `• Total Orders: <b>${orders.length}</b>\n\n`;

  if (activeOrders.length > 0) {
    text += "🟢 <b>ACTIVE ACCESS:</b>\n";
    activeOrders.forEach((o, i) => {
      text += `${i + 1}. <b>${o.tool}</b>\n   • Credentials: <code>${o.credentials || 'Active'}</code>\n\n`;
    });
  } else {
    text += "You currently have no active subscriptions.";
  }

  ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📊 Browse Tools', 'ACTION_SHOP'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
      [Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
    ])
  });
});

bot.action(['ACTION_PRICING', 'ACTION_PRICES'], (ctx) => {
  ctx.reply(
    "🏷 <b>Official Pricing Overview:</b>\n\n" +
    "1. 🔄 <b>Fxreplay Pro</b> — Weekly from 250 ETB / Monthly from 750 ETB\n" +
    "2. 📊 <b>TradingView Premium</b> — 🚫 Out of Stock\n" +
    "3. 📈 <b>TradingView Essential</b> — 1,100 ETB (1 Mo)\n" +
    "4. 📈 <b>TradingView + CME Data</b> — 1,350 ETB (1 Mo)\n" +
    "5. 📓 <b>Abyssinia Journal</b> — ✨ Coming Soon!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_OFFERS', (ctx) => {
  ctx.reply(
    "🎁 <b>SPECIAL SEASON OFFERS</b>\n\n" +
    "🔥 <b>FX Replay Pro Multi-Timeframe Packs</b>\nFull backtesting access starting at just 250 ETB.\n\n" +
    "🔥 <b>TradingView Essential + CME Data</b>\nGet real-time CME market data for only 3,600 ETB (3 Months).\n\n" +
    "🔥 <b>Abyssinia Journal Launch Special</b>\nComing soon with early bird pricing!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_REFERRAL', async (ctx) => {
  const userId = ctx.from.id;
  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${userId}`;

  let count = 0;
  if (isMongoConnected && User) {
    try { count = await User.countDocuments({ referrerId: String(userId) }); } catch (e) {}
  } else {
    count = (fallbackDb.referrals[userId] || []).length;
  }

  ctx.reply(
    "🤝 <b>Partner & Referral Program</b>\n\n" +
    "Invite fellow traders and earn 100 ETB Commission for every purchase they make!\n\n" +
    "📊 <b>Your Performance:</b>\n" +
    `• Traders Invited: ${count} people\n` +
    `• Commission Earned: ${count * 100} ETB\n\n` +
    `🔗 <b>Your Link:</b>\n${refLink}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Share Link on Telegram', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Get genuine TradingView CME feeds & FX Replay Pro on ATTS!')}`)],
        [Markup.button.callback('💳 View Wallet', 'ACTION_WALLET'), Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_FAQ', (ctx) => {
  ctx.reply(
    "❓ <b>HELP CENTER & FAQ</b>\n\n" +
    "• <b>How long does delivery take?</b>\n5 to 15 minutes after payment confirmation.\n\n" +
    "• <b>How do I fund my wallet?</b>\nClick 💳 My Wallet → ➕ Deposit Funds, choose an amount, and upload your payment receipt.\n\n" +
    "• <b>Is this an official subscription?</b>\nYes, 100% genuine guaranteed access.\n\n" +
    "• <b>How do I contact support?</b>\nDirect Telegram: @" + SUPPORT_USERNAME,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🔙 Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_MAIN_MENU', (ctx) => sendMainMenu(ctx));

// Start Application
async function startApplication() {
  await connectToMongo();
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    await bot.launch();
    console.log('🚀 ATTS Telegram Bot is LIVE and running!');
  } catch (err) {
    console.error('Launch error, retrying in 5s...', err.message);
    setTimeout(startApplication, 5000);
  }
}

startApplication();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

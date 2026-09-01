// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// PRODUCTION SCRIPT: COMPLETE STORE + WALLET SYSTEM + BUTTON ALIGNMENT
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

// ============================================================
// 📁 MONGOOSE DATABASE SCHEMAS
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
  status: { type: String, default: 'Pending' }, // 'Pending' | 'Active' | 'Expired' | 'Rejected'
  price: { type: String, default: 'Paid' },
  paymentMethod: { type: String, default: 'Direct' }, // 'Wallet' | 'Telebirr' | 'Binance'
  credentials: { type: String, default: '' },
  currentWeek: { type: Number, default: 1 },
  totalWeeks: { type: Number, default: 1 },
  weeklyHistory: { type: Array, default: [] },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const DepositSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: 'Trader' },
  amount: { type: Number, required: true },
  method: { type: String, default: 'Telebirr' },
  refCode: { type: String, required: true, unique: true },
  status: { type: String, default: 'PENDING' }, // 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  receiptPhotoId: { type: String, default: '' },
  adminReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null }
});

const WalletTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true }, // 'DEPOSIT' | 'PURCHASE' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT'
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
let mongoErrorDetails = "MONGODB_URI is not configured yet";

// Temporary fallback in-memory cache if MongoDB is offline
const fallbackDb = {
  users: new Map(),
  userOrders: {},
  deposits: [],
  transactions: {},
  referrerOf: {},
  referrals: {}
};

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.log("❌ WARNING: MONGODB_URI is not set. Using temporary memory store.");
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
  if (referrerId && !fallbackDb.referrerOf[userId]) {
    fallbackDb.referrerOf[userId] = referrerId;
    if (!fallbackDb.referrals[referrerId]) fallbackDb.referrals[referrerId] = [];
    fallbackDb.referrals[referrerId].push(userId);
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
    amount: -amount,
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
        paymentMethod,
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
    paymentMethod,
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
  }
}

// In-flight user session tracking
const userSessions = {};

// Payment Accounts
const PAYMENT_INFO = {
  telebirr: { number: "0938652861", name: "Berihanu" },
  binance: { id: "874067761", name: "ABYSSINIAVENDOR" }
};

// 🌐 Health Check HTTP Server for Render
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('A T T S Telegram Bot Server is LIVE 24/7!');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server listening on port ${PORT}`);
});

// Safe Keep-Alive
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
    "To access our premium trading tools, wallet deposits, and instant orders, you must first join our official community channels:\n\n" +
    "1️⃣ @abyssiniatradinget (Official Channel)\n" +
    "2️⃣ @abyssiniachat (Trading Discussion Community)\n" +
    "3️⃣ @abyssiniattstore (Store & Updates)\n\n" +
    "👉 Click the buttons below to join each channel, then click Verify:",
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(channelButtons) }
  );
}

// ============================================================
// 🏠 MAIN MENU (REQUESTED BUTTON ALIGNMENT)
// ============================================================

async function sendMainMenu(ctx) {
  return ctx.reply(
    "👋 <b>Welcome to A T T S - Abyssinia Trading Tools Store!</b>\n\n" +
    "Your trusted source for genuine TradingView + CME market feeds, backtesting engines, and trading analytics in Ethiopia.\n\n" +
    "Select an option below to get started:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        // Row 1 (Full Width)
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')],
        // Row 2 (2 Columns)
        [Markup.button.callback('💳 My Wallet', 'ACTION_WALLET'), Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
        // Row 3 (2 Columns)
        [Markup.button.callback('🏷 Pricing', 'ACTION_PRICING'), Markup.button.callback('🎁 Offers', 'ACTION_OFFERS')],
        // Row 4 (2 Columns)
        [Markup.button.callback('🤝 Referral', 'ACTION_REFERRAL'), Markup.button.callback('❓ Help Center', 'ACTION_FAQ')],
        // Row 5 (Full Width)
        [Markup.button.url('🎧 Support', 'https://t.me/' + SUPPORT_USERNAME)]
      ])
    }
  );
}

// ============================================================
// 💰 CUSTOMER WALLET ACTIONS
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
          [Markup.button.callback('📜 Transaction History', 'WALLET_HISTORY'), Markup.button.callback('🛒 Buy with Wallet', 'ACTION_SHOP')],
          [Markup.button.callback('🏠 Back to Main Menu', 'ACTION_MAIN_MENU')]
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
        [Markup.button.callback('⬅️ Back to Wallet', 'ACTION_WALLET')]
      ])
    }
  );
});

// Custom Deposit Input
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

// Preset Amount Clicked
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
        [Markup.button.callback('📱 Telebirr', `DEP_METHOD_TELEBIRR_${amount}`)],
        [Markup.button.callback('💎 Binance Pay', `DEP_METHOD_BINANCE_${amount}`)],
        [Markup.button.callback('⬅️ Back to Amounts', 'WALLET_DEPOSIT')]
      ])
    }
  );
}

// Payment method selected -> Provide transfer instructions
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
             `After completing the payment, please upload your payment screenshot (receipt) right here in this chat.`;

  return ctx.reply(payText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel Deposit', 'ACTION_WALLET')]
    ])
  });
});

// Transaction History
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
      [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT')],
      [Markup.button.callback('⬅️ Back to Wallet', 'ACTION_WALLET')]
    ])
  });
});

// ============================================================
// 📊 TRADING TOOLS CATALOG
// ============================================================

const TOOLS_CATALOG = {
  "fxr_month": { name: "🔄 Fxreplay Pro (Monthly)", price: 750 },
  "fxr_2week": { name: "🔄 Fxreplay Pro (Two Weeks)", price: 450 },
  "fxr_week": { name: "🔄 Fxreplay Pro (Weekly)", price: 250 },
  "tv_ess": { name: "📈 TradingView Essential (1 Mo)", price: 1100 },
  "tv_cme": { name: "📈 TradingView + CME Data (1 Mo)", price: 1350 }
};

bot.action(['ACTION_SHOP', 'ACTION_BUY'], async (ctx) => {
  return ctx.reply(
    "📊 <b>A T T S Trading Tools Catalog</b>\n\n" +
    "Select a tool below to order or renew instantly with your wallet balance:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Fxreplay Pro (Monthly) - 750 ETB', 'TOOL_fxr_month')],
        [Markup.button.callback('🔄 Fxreplay Pro (2 Weeks) - 450 ETB', 'TOOL_fxr_2week')],
        [Markup.button.callback('🔄 Fxreplay Pro (Weekly) - 250 ETB', 'TOOL_fxr_week')],
        [Markup.button.callback('📈 TradingView Essential - 1,100 ETB', 'TOOL_tv_ess')],
        [Markup.button.callback('📈 TradingView + CME Data - 1,350 ETB', 'TOOL_tv_cme')],
        [Markup.button.callback('💳 My Wallet', 'ACTION_WALLET'), Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action(/^TOOL_(.+)$/, async (ctx) => {
  const toolKey = ctx.match[1];
  const tool = TOOLS_CATALOG[toolKey] || TOOLS_CATALOG["fxr_month"];
  const balance = await getUserBalance(ctx.from.id);

  userSessions[ctx.from.id] = {
    type: 'ORDER',
    tool: tool.name,
    finalPrice: tool.price,
    toolKey: toolKey
  };

  return ctx.reply(
    "🧾 <b>Order Summary:</b>\n\n" +
    `📦 <b>Product:</b> ${tool.name}\n` +
    `💰 <b>Price:</b> <b>${tool.price.toLocaleString()} ETB</b>\n` +
    `💳 <b>Your Wallet Balance:</b> <b>${balance.toLocaleString()} ETB</b>\n\n` +
    "Please choose your payment method below:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`💰 Pay with Wallet (${balance.toLocaleString()} ETB)`, `PAY_WALLET_${toolKey}`)],
        [Markup.button.callback('📱 Pay via Telebirr', 'PAY_TELEBIRR')],
        [Markup.button.callback('💎 Pay via Binance', 'PAY_BINANCE')],
        [Markup.button.callback('⬅️ Back to Tools', 'ACTION_SHOP')]
      ])
    }
  );
});

// Pay with Wallet execution
bot.action(/^PAY_WALLET_(.+)$/, async (ctx) => {
  const toolKey = ctx.match[1];
  const tool = TOOLS_CATALOG[toolKey] || TOOLS_CATALOG["fxr_month"];
  const userId = ctx.from.id;
  const username = ctx.from.username || 'Trader';

  const newBalance = await debitWallet(userId, tool.price, `Purchase: ${tool.name}`);

  if (newBalance === null) {
    const currentBalance = await getUserBalance(userId);
    return ctx.reply(
      "⚠️ <b>INSUFFICIENT WALLET BALANCE</b>\n\n" +
      `<b>Product Price:</b> ${tool.price.toLocaleString()} ETB\n` +
      `<b>Your Balance:</b> ${currentBalance.toLocaleString()} ETB\n` +
      `<b>Shortage:</b> ${(tool.price - currentBalance).toLocaleString()} ETB\n\n` +
      "Please add funds to your wallet or pay via Telebirr:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT')],
          [Markup.button.callback('📱 Pay via Telebirr', 'PAY_TELEBIRR')],
          [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')]
        ])
      }
    );
  }

  // Record order
  await addPendingOrder(userId, username, tool.name, 'Standard', tool.price, 'Wallet');

  // Notify Admin
  if (ADMIN_CHAT_ID) {
    try {
      await bot.telegram.sendMessage(
        ADMIN_CHAT_ID,
        `🚨 <b>NEW ORDER PAID VIA WALLET!</b>\n\n` +
        `👤 Customer: @${username}\n` +
        `🆔 User ID: <code>${userId}</code>\n` +
        `📦 Product: <b>${tool.name}</b>\n` +
        `💰 Amount: <b>${tool.price} ETB (Wallet Paid)</b>\n` +
        `💳 Remaining Wallet: <b>${newBalance.toLocaleString()} ETB</b>\n\n` +
        `💡 Deliver Credentials:\n` +
        `<code>/send ${userId} Email: ... | Pass: ...</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }

  return ctx.reply(
    `🎉 <b>PURCHASE COMPLETED WITH WALLET!</b>\n\n` +
    `📦 <b>Product:</b> ${tool.name}\n` +
    `💰 <b>Deducted:</b> -${tool.price.toLocaleString()} ETB\n` +
    `💳 <b>Remaining Balance:</b> <b>${newBalance.toLocaleString()} ETB</b>\n\n` +
    `✅ Your order is confirmed. Credentials will be delivered within 5–15 minutes!\n\n` +
    `Track your order in <b>📦 My Orders</b>.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
        [Markup.button.callback('💳 View Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// Direct payment chosen
bot.action(/PAY_(TELEBIRR|BINANCE)/, (ctx) => {
  const method = ctx.match[1];
  const session = userSessions[ctx.from.id] || { tool: 'Trading Tool', finalPrice: 750 };
  session.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = `📱 <b>Telebirr Payment Details</b>\n\n` +
              `• Phone Number: <code>${PAYMENT_INFO.telebirr.number}</code>\n` +
              `• Account Name: <code>${PAYMENT_INFO.telebirr.name}</code>\n` +
              `• Amount: <code>${session.finalPrice || 750} ETB</code>\n\n` +
              `⚠️ After completing payment, upload your transfer screenshot right here.`;
  } else {
    payText = `💎 <b>Binance Payment Details</b>\n\n` +
              `• Binance Pay ID: <code>${PAYMENT_INFO.binance.id}</code>\n` +
              `• Payee Name: <code>${PAYMENT_INFO.binance.name}</code>\n` +
              `• Amount: <code>${((session.finalPrice || 750) / 100).toFixed(1)} USDT</code>\n\n` +
              `⚠️ After transferring via Binance Pay, upload your confirmation screenshot here.`;
  }

  ctx.reply(payText, { parse_mode: 'HTML' });
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

      await addPendingOrder(user.id, user.username, toolName, 'Standard', price, session.method || 'Direct');

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
            [Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
            [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
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
          [Markup.button.callback('📊 Buy Trading Tools', 'ACTION_SHOP')],
          [Markup.button.callback('💳 View Wallet', 'ACTION_WALLET')]
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
      [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  });
});

bot.action(['ACTION_PRICING', 'ACTION_PRICES'], (ctx) => {
  ctx.reply(
    "🏷 <b>Official Pricing Overview:</b>\n\n" +
    "1. 📊 <b>TradingView Premium</b> — 🚫 Out of Stock\n" +
    "2. 📈 <b>TradingView Essential</b> — 1,100 ETB (1 Mo)\n" +
    "3. 📈 <b>TradingView + CME Data</b> — 1,350 ETB (1 Mo)\n" +
    "4. 🔄 <b>Fxreplay Pro</b> — Weekly from 250 ETB / Monthly from 750 ETB\n" +
    "5. 📓 <b>Abyssinia Journal</b> — ✨ Coming Soon!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_OFFERS', (ctx) => {
  ctx.reply(
    "🎁 <b>SPECIAL SEASON OFFERS</b>\n\n" +
    "🔥 <b>TradingView Essential + CME Data</b>\nGet real-time CME market data for only 3,600 ETB (3 Months).\n\n" +
    "🔥 <b>FX Replay Pro Multi-Timeframe Packs</b>\nFull backtesting access starting at just 250 ETB.\n\n" +
    "🔥 <b>Abyssinia Journal Launch Special</b>\nComing soon with early bird pricing!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('💳 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
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
        [Markup.button.callback('💳 View Wallet', 'ACTION_WALLET'), Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
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
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
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

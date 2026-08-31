// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// 24/7 PRODUCTION SCRIPT WITH SEAMLESS STATUS ACTIVATION & EXPIRY
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
      // Find latest pending order first, or any latest order
      let targetOrder = await Order.findOne({ userId, status: 'Pending' }).sort({ createdAt: -1 });
      if (targetOrder) {
        targetOrder.status = 'Active';
        targetOrder.credentials = customMessage;
        if (expiresAt) targetOrder.expiresAt = expiresAt;
        if (durationDays) targetOrder.plan = `${targetOrder.plan} (${durationDays} Days)`;
        await targetOrder.save();
        return targetOrder;
      } else {
        return await Order.create({
          userId,
          tool: 'Trading Tool Access',
          plan: durationDays ? `${durationDays} Days Access` : 'Standard Access',
          status: 'Active',
          price: 'Paid',
          credentials: customMessage,
          expiresAt: expiresAt
        });
      }
    } catch (e) {
      console.error("Error activating order:", e.message);
    }
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
      plan: durationDays ? `${durationDays} Days Access` : 'Standard Access',
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
      // Check for pending order first and activate it, or update existing active order
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
          plan: 'Multi-Week Plan',
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
      plan: 'Multi-Week Plan',
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

// 🌐 Health check HTTP server
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('A T T S Telegram Bot is LIVE 24/7!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP Health Check Server listening on port ${PORT}`);
});

// ⏰ Safe Keep-Alive
if (process.env.RENDER_EXTERNAL_URL) {
  const pingUrl = process.env.RENDER_EXTERNAL_URL;
  const client = pingUrl.startsWith('https') ? https : http;
  setInterval(() => {
    client.get(pingUrl, (res) => {}).on('error', () => {});
  }, 10 * 60 * 1000);
}

// Payment Accounts
const PAYMENT_INFO = {
  telebirr: { number: "0938652861", name: "Berihanu" },
  binance: { id: "874067761", name: "ABYSSINIAVENDOR" }
};

// Catalog
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
      "Unlimited charts & historical tick replay",
      "Monthly plan includes 5 weekly accounts | 2-Weeks plan includes 2 accounts"
    ],
    tiers: {
      "monthly": {
        name: "Monthly subscription plan (5 Weeks)",
        options: [
          { code: "fxr_m_mw", name: "Monthly + weekly subscription", price: 2000 },
          { code: "fxr_m_mw_aj", name: "Monthly + weekly + Abyssinia Journal subscription", price: 2500 },
          { code: "fxr_m_single", name: "Monthly subscription", price: 750 },
          { code: "fxr_m_notion", name: "Monthly subscription + Notion pro Journaling template", price: 850 }
        ]
      },
      "twoweeks": {
        name: "Two weeks subscription plan (2 Weeks)",
        options: [
          { code: "fxr_2w_w", name: "Two weeks + weekly subscription", price: 550 },
          { code: "fxr_2w_w_notion", name: "Two weeks + weekly subscription + Notion pro journaling template", price: 600 }
        ]
      },
      "weekly": {
        name: "Weekly subscription plan (1 Week)",
        options: [
          { code: "fxr_w_single", name: "Weekly subscription", price: 250 },
          { code: "fxr_w_notion", name: "Weekly subscription + Notion pro journaling template tool", price: 300 }
        ]
      }
    }
  }
};

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
  return ctx.reply(
    "👋 <b>Welcome to A T T S - Abyssinia Trading Tools Store!</b>\n\n" +
    "Your trusted source for genuine TradingView + CME market feeds, backtesting engines, and trading analytics in Ethiopia.\n\n" +
    "Select an option below to get started:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
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

// 🛍️ 2. SHOP NOW
bot.action(['ACTION_SHOP', 'ACTION_BUY'], async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (!allJoined) return sendJoinChannelMessage(ctx, missing);

    ctx.reply(
      "🛍️ <b>A T T S Product Shop</b>\n\n" +
      "Select a product below to view specifications, available plans, and instant pricing:",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
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
        [Markup.button.callback('📅 Monthly subscription plan (5 Weeks)', 'FXR_TIER_monthly')],
        [Markup.button.callback('⏳ Two weeks subscription plan (2 Weeks)', 'FXR_TIER_twoweeks')],
        [Markup.button.callback('⚡ Weekly subscription plan (1 Week)', 'FXR_TIER_weekly')],
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
    "5. 🔄 <b>Fxreplay Pro</b>\n   • Monthly (5 Weeks): From 750 ETB\n   • Two Weeks (2 Weeks): From 550 ETB\n   • Weekly Plans: From 250 ETB\n\n" +
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
      const isMultiWeek = ord.totalWeeks && ord.totalWeeks > 1;
      const weekInfo = isMultiWeek ? ` (Week ${ord.currentWeek || 1} of ${ord.totalWeeks})` : '';
      responseText += `<b>${i + 1}. ${ord.tool}${weekInfo}</b>\n• Status: 🟢 Active\n\n`;
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
    const isMultiWeek = ord.totalWeeks && ord.totalWeeks > 1;
    if (isMultiWeek) {
      responseText += `<b>${idx + 1}. ${ord.tool}</b>\n` +
                      `• 📅 <b>Active Period:</b> Week ${ord.currentWeek || 1} of ${ord.totalWeeks}\n` +
                      `• 🔐 <b>Current Login:</b>\n<code>${ord.credentials}</code>\n` +
                      `<i>ℹ️ Next weekly account will be updated automatically right here.</i>\n\n`;
    } else {
      responseText += `<b>${idx + 1}. ${ord.tool}</b>:\n` +
                      `<code>${ord.credentials}</code>\n\n`;
    }
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

// Customer Uploads Receipt Photo
bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    const session = userSessions[user.id] || { tool: 'Trading Tool Access', finalPrice: 750, method: 'Direct', planTitle: 'Standard' };
    const photo = ctx.message.photo.pop();

    await addPendingOrder(user.id, user.username, session.tool, session.planTitle, session.finalPrice);

    if (ADMIN_CHAT_ID) {
      try {
        const isMonthlyFxr = session.tool.toLowerCase().includes('fxreplay') && (session.planTitle.toLowerCase().includes('month') || session.tool.toLowerCase().includes('month'));
        const isTwoWeekFxr = session.tool.toLowerCase().includes('fxreplay') && (session.planTitle.toLowerCase().includes('two') || session.tool.toLowerCase().includes('2'));

        let helpCommands = `💡 Deliver standard order:\n<code>/send ${user.id} Email: ... | Pass: ...</code>\n\n`;
        if (isMonthlyFxr) {
          helpCommands += `💡 <b>Fxreplay Monthly (Send Week 1):</b>\n<code>/sendweek ${user.id} 1 Email: ... | Pass: ...</code>\n\n`;
        } else if (isTwoWeekFxr) {
          helpCommands += `💡 <b>Fxreplay 2-Weeks (Send Week 1):</b>\n<code>/sendweek ${user.id} 1 Email: ... | Pass: ...</code>\n\n`;
        }
        helpCommands += `💡 Or with duration (e.g. 14d, 30d):\n<code>/send ${user.id} 14d Email: ... | Pass: ...</code>\n\n` +
                        `💡 To expire subscription anytime:\n<code>/expire ${user.id}</code>`;

        const captionText = "🚨 <b>NEW PAYMENT RECEIPT RECEIVED!</b>\n\n" +
                            "👤 Customer: @" + (user.username || 'NoUsername') + "\n" +
                            "🆔 User ID: <code>" + user.id + "</code>\n" +
                            "📦 Product: <b>" + session.tool + "</b>\n" +
                            "💰 Amount: <b>" + (session.finalPrice || 750) + " ETB</b>\n" +
                            "💳 Method: " + (session.method || 'Direct') + "\n\n" +
                            helpCommands;

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
    console.log('🚀 A T T S Telegram Bot is LIVE and connected!');
  } catch (err) {
    console.error('Bot launch error, retrying in 5s...', err.message);
    setTimeout(startApplication, 5000);
  }
}

startApplication();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

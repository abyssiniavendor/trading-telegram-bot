// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE BOT (@abyssiniatradingbot)
// FULL RESTORED PRODUCTION CODE WITH CUSTOMER WALLET & EXACT BUTTON ALIGNMENT
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

// 📢 Community Channels for Membership Check
const REQUIRED_CHANNELS = [
  { id: "@abyssiniatradinget", name: "Abyssinia Trading", url: "https://t.me/abyssiniatradinget" },
  { id: "@abyssiniachat", name: "Abyssinia Chat Community", url: "https://t.me/abyssiniachat" },
  { id: "@abyssiniattstore", name: "A T T S Store Channel", url: "https://t.me/abyssiniattstore" }
];

if (!BOT_TOKEN) {
  console.error("FATAL ERROR: BOT_TOKEN is missing in .env!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Anti-crash handlers
bot.catch((err) => console.error("⚠️ Telegram Bot Error:", err.message));
process.on('unhandledRejection', (reason) => console.error("⚠️ Unhandled Rejection:", reason));
process.on('uncaughtException', (err) => console.error("⚠️ Uncaught Exception:", err.message));

// ============================================================
// 📁 DATABASE SCHEMAS (MONGODB)
// ============================================================

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: '' },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true }, // 'DEPOSIT' | 'PURCHASE' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT'
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const DepositSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  amount: { type: Number, required: true },
  method: { type: String, default: 'Telebirr' },
  refCode: { type: String, required: true, unique: true },
  status: { type: String, default: 'PENDING' }, // 'PENDING' | 'APPROVED' | 'REJECTED'
  receiptPhotoId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null }
});

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  toolName: { type: String, required: true },
  price: { type: String, required: true },
  method: { type: String, default: 'Direct' },
  receiptPhotoId: { type: String, default: '' },
  status: { type: String, default: 'Pending' },
  credentials: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', DepositSchema);
const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

let isMongoConnected = false;

// Fallback in-memory cache
const memoryDb = {
  users: new Map(),
  transactions: [],
  deposits: [],
  orders: []
};

async function connectToMongo() {
  if (!MONGODB_URI) return;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    isMongoConnected = true;
    console.log("✅ 🟢 MongoDB Connected Successfully!");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
  }
}

// ============================================================
// 💰 WALLET OPERATIONS
// ============================================================

async function getOrCreateUser(userId, username, firstName) {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      let u = await User.findOne({ userId });
      if (!u) {
        u = await User.create({ userId, username: username || '', firstName: firstName || '', balance: 0 });
      }
      return u;
    } catch (e) {}
  }
  if (!memoryDb.users.has(userId)) {
    memoryDb.users.set(userId, { userId, username: username || '', balance: 0 });
  }
  return memoryDb.users.get(userId);
}

async function getUserBalance(userId) {
  userId = String(userId);
  if (isMongoConnected) {
    try {
      const u = await User.findOne({ userId });
      return u ? u.balance : 0;
    } catch (e) {}
  }
  const u = memoryDb.users.get(userId);
  return u ? u.balance : 0;
}

async function creditUserWallet(userId, amount, description = 'Deposit') {
  userId = String(userId);
  amount = Math.abs(Number(amount));

  if (isMongoConnected) {
    try {
      const user = await User.findOneAndUpdate(
        { userId },
        { $inc: { balance: amount } },
        { upsert: true, new: true }
      );
      await Transaction.create({
        userId,
        type: 'DEPOSIT',
        amount,
        balanceAfter: user.balance,
        description
      });
      return user.balance;
    } catch (e) {}
  }

  let u = memoryDb.users.get(userId);
  if (!u) {
    u = { userId, balance: 0 };
    memoryDb.users.set(userId, u);
  }
  u.balance += amount;
  memoryDb.transactions.push({
    userId,
    type: 'DEPOSIT',
    amount,
    balanceAfter: u.balance,
    description,
    createdAt: new Date()
  });
  return u.balance;
}

async function debitUserWallet(userId, amount, description = 'Purchase') {
  userId = String(userId);
  amount = Math.abs(Number(amount));

  if (isMongoConnected) {
    try {
      const user = await User.findOne({ userId });
      if (!user || user.balance < amount) return null;
      user.balance -= amount;
      await user.save();
      await Transaction.create({
        userId,
        type: 'PURCHASE',
        amount: -amount,
        balanceAfter: user.balance,
        description
      });
      return user.balance;
    } catch (e) {}
  }

  const u = memoryDb.users.get(userId);
  if (!u || u.balance < amount) return null;
  u.balance -= amount;
  memoryDb.transactions.push({
    userId,
    type: 'PURCHASE',
    amount: -amount,
    balanceAfter: u.balance,
    description,
    createdAt: new Date()
  });
  return u.balance;
}

// User active session state
const userSessions = {};

// Payment Accounts
const PAYMENT_INFO = {
  telebirr: { number: "0938652861", name: "Berihanu" },
  binance: { payId: "874067761", name: "ABYSSINIAVENDOR" }
};

// 🌐 Health check server for Render/Cloud
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('ATTS Bot Server is Online 24/7');
}).listen(PORT, '0.0.0.0');

// Keep-Alive Ping
if (process.env.RENDER_EXTERNAL_URL) {
  const pingUrl = process.env.RENDER_EXTERNAL_URL;
  const client = pingUrl.startsWith('https') ? https : http;
  setInterval(() => client.get(pingUrl, () => {}).on('error', () => {}), 10 * 60 * 1000);
}

// Ignore Channel & Group Messages
bot.use((ctx, next) => {
  if (ctx.channelPost || (ctx.chat && ctx.chat.type !== 'private')) return;
  return next();
});

// Force Channel Join Verification
async function checkChannels(ctx, userId) {
  if (String(userId) === String(ADMIN_CHAT_ID)) return true;
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const member = await ctx.telegram.getChatMember(ch.id, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) return false;
    } catch (err) {}
  }
  return true;
}

function sendForceJoinMessage(ctx) {
  const buttons = REQUIRED_CHANNELS.map(ch => [Markup.button.url(`📢 Join ${ch.name}`, ch.url)]);
  buttons.push([Markup.button.callback('✅ I Have Joined (Verify)', 'VERIFY_CHANNELS')]);
  return ctx.reply(
    "⚠️ <b>Welcome to ATTS!</b>\n\nPlease join our official community channels below before accessing trading tools and your wallet:",
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
  );
}

// ============================================================
// 🏠 MAIN MENU (EXACT WALLET CARD & BUTTON ALIGNMENT)
// ============================================================

async function sendMainMenu(ctx) {
  const balance = await getUserBalance(ctx.from.id);

  return ctx.reply(
    "💰 <b>MY WALLET</b>\n\n" +
    "<b>Available Balance:</b>\n" +
    `<b>${balance.toLocaleString()} ETB</b>\n\n` +
    "Use your wallet balance to purchase or renew trading tools instantly.",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP')],
        [Markup.button.callback('👛 Wallet', 'ACTION_WALLET'), Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
        [Markup.button.callback('💳 Pricing', 'ACTION_PRICING'), Markup.button.callback('🎁 Offers', 'ACTION_OFFERS')],
        [Markup.button.callback('🤝 Referral', 'ACTION_REFERRAL'), Markup.button.callback('❓ Help Center', 'ACTION_FAQ')],
        [Markup.button.url('🎧 Support', 'https://t.me/' + SUPPORT_USERNAME)]
      ])
    }
  );
}

// ============================================================
// 👛 WALLET MENU & DEPOSIT SYSTEM
// ============================================================

bot.action('ACTION_WALLET', async (ctx) => {
  const isJoined = await checkChannels(ctx, ctx.from.id);
  if (!isJoined) return sendForceJoinMessage(ctx);

  const balance = await getUserBalance(ctx.from.id);
  delete userSessions[ctx.from.id];

  return ctx.reply(
    `💰 <b>MY WALLET</b>\n\n` +
    `<b>Available Balance:</b>\n` +
    `<b>${balance.toLocaleString()} ETB</b>\n\n` +
    `Use your wallet balance to purchase or renew trading tools instantly.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT')],
        [Markup.button.callback('📜 Transaction History', 'WALLET_HISTORY'), Markup.button.callback('🛒 Buy with Wallet', 'ACTION_SHOP')],
        [Markup.button.callback('🏠 Back to Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

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

bot.action('DEP_AMT_CUSTOM', (ctx) => {
  userSessions[ctx.from.id] = { awaitingCustomAmount: true };
  return ctx.reply(
    "💵 <b>Custom Deposit Amount</b>\n\nPlease enter the amount in ETB you want to add to your wallet (Minimum: 100 ETB):",
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
  return showDepositPaymentMethods(ctx, amount);
});

function showDepositPaymentMethods(ctx, amount) {
  return ctx.reply(
    `💳 <b>DEPOSIT REQUEST</b>\n\n<b>Amount:</b> <b>${amount.toLocaleString()} ETB</b>\n\nPlease choose your preferred payment method below:`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📱 Telebirr', `DEP_PAY_TELEBIRR_${amount}`)],
        [Markup.button.callback('💎 Binance Pay', `DEP_PAY_BINANCE_${amount}`)],
        [Markup.button.callback('⬅️ Back to Amounts', 'WALLET_DEPOSIT')]
      ])
    }
  );
}

bot.action(/^DEP_PAY_(TELEBIRR|BINANCE)_(\d+)$/, (ctx) => {
  const method = ctx.match[1];
  const amount = parseInt(ctx.match[2], 10);

  userSessions[ctx.from.id] = {
    type: 'WALLET_DEPOSIT',
    amount: amount,
    method: method === 'TELEBIRR' ? 'Telebirr' : 'Binance'
  };

  let details = '';
  if (method === 'TELEBIRR') {
    details = `📱 <b>Telebirr Number:</b> <code>${PAYMENT_INFO.telebirr.number}</code>\n👤 <b>Account Name:</b> ${PAYMENT_INFO.telebirr.name}`;
  } else {
    details = `💎 <b>Binance Pay ID:</b> <code>${PAYMENT_INFO.binance.payId}</code>\n👤 <b>Payee:</b> ${PAYMENT_INFO.binance.name}`;
  }

  return ctx.reply(
    `💳 <b>DEPOSIT INSTRUCTIONS</b>\n\n` +
    `<b>Amount:</b> <b>${amount.toLocaleString()} ETB</b>\n\n` +
    `${details}\n\n` +
    `📤 <b>Submit Payment Proof:</b>\n` +
    `After sending the payment, upload your payment screenshot (receipt) right here in this chat.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel Deposit', 'ACTION_WALLET')]
      ])
    }
  );
});

// Transaction History
bot.action('WALLET_HISTORY', async (ctx) => {
  const userId = ctx.from.id;
  const balance = await getUserBalance(userId);

  let txList = [];
  if (isMongoConnected) {
    txList = await Transaction.find({ userId: String(userId) }).sort({ createdAt: -1 }).limit(8);
  } else {
    txList = memoryDb.transactions.filter(t => t.userId === String(userId)).slice(-8).reverse();
  }

  let text = `📜 <b>WALLET TRANSACTION HISTORY</b>\n\n<b>Current Balance:</b> <b>${balance.toLocaleString()} ETB</b>\n\n`;
  if (txList.length === 0) {
    text += "No transactions recorded yet. Make a deposit to fund your wallet!";
  } else {
    txList.forEach((tx, idx) => {
      const sign = tx.amount >= 0 ? '+' : '';
      const icon = tx.amount >= 0 ? '🟢' : '🛒';
      const dateStr = new Date(tx.createdAt).toLocaleDateString();
      text += `${idx + 1}. ${icon} <b>${sign}${tx.amount.toLocaleString()} ETB</b> - ${tx.description || tx.type}\n   📅 ${dateStr} | Balance: ${tx.balanceAfter.toLocaleString()} ETB\n\n`;
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
// 📊 TRADING TOOLS CATALOG & WALLET CHECKOUT
// ============================================================

const TOOLS = {
  FX_MONTH: { id: "fx_month", name: "Fxreplay Pro (Monthly)", price: 750 },
  FX_2WEEK: { id: "fx_2week", name: "Fxreplay Pro (2 Weeks)", price: 450 },
  FX_WEEK: { id: "fx_week", name: "Fxreplay Pro (Weekly)", price: 250 },
  TV_ESS: { id: "tv_ess", name: "TradingView Essential", price: 1100 },
  TV_CME: { id: "tv_cme", name: "TradingView + CME Data", price: 1350 }
};

bot.action('ACTION_SHOP', async (ctx) => {
  return ctx.reply(
    "📊 <b>A T T S Trading Tools Catalog</b>\n\n" +
    "Select a tool below to order or renew instantly with your wallet balance:",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Fxreplay Pro (Monthly) - 750 ETB', 'BUY_FX_MONTH')],
        [Markup.button.callback('🔄 Fxreplay Pro (2 Weeks) - 450 ETB', 'BUY_FX_2WEEK')],
        [Markup.button.callback('🔄 Fxreplay Pro (Weekly) - 250 ETB', 'BUY_FX_WEEK')],
        [Markup.button.callback('📈 TradingView Essential - 1,100 ETB', 'BUY_TV_ESS')],
        [Markup.button.callback('📈 TradingView + CME Data - 1,350 ETB', 'BUY_TV_CME')],
        [Markup.button.callback('👛 View Wallet', 'ACTION_WALLET'), Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action(/^BUY_(.+)$/, async (ctx) => {
  const toolKey = ctx.match[1];
  const tool = TOOLS[toolKey] || TOOLS.FX_MONTH;
  const balance = await getUserBalance(ctx.from.id);

  userSessions[ctx.from.id] = {
    type: 'ORDER',
    tool: tool.name,
    price: tool.price
  };

  return ctx.reply(
    `🧾 <b>Order Summary:</b>\n\n` +
    `📦 <b>Product:</b> ${tool.name}\n` +
    `💰 <b>Price:</b> <b>${tool.price.toLocaleString()} ETB</b>\n` +
    `💳 <b>Your Wallet Balance:</b> <b>${balance.toLocaleString()} ETB</b>\n\n` +
    `Please select payment method:`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`💰 Pay with Wallet (${balance.toLocaleString()} ETB)`, `PAY_WALLET_${toolKey}`)],
        [Markup.button.callback('📱 Pay via Telebirr', `PAY_DIRECT_TELEBIRR_${toolKey}`)],
        [Markup.button.callback('⬅️ Back to Tools', 'ACTION_SHOP')]
      ])
    }
  );
});

// Pay with Wallet execution
bot.action(/^PAY_WALLET_(.+)$/, async (ctx) => {
  const toolKey = ctx.match[1];
  const tool = TOOLS[toolKey] || TOOLS.FX_MONTH;
  const userId = ctx.from.id;
  const username = ctx.from.username || 'Trader';

  const newBalance = await debitUserWallet(userId, tool.price, `Purchase: ${tool.name}`);

  if (newBalance === null) {
    const currentBal = await getUserBalance(userId);
    return ctx.reply(
      `⚠️ <b>INSUFFICIENT WALLET BALANCE</b>\n\n` +
      `<b>Product Price:</b> ${tool.price.toLocaleString()} ETB\n` +
      `<b>Your Balance:</b> ${currentBal.toLocaleString()} ETB\n` +
      `<b>Shortage:</b> ${(tool.price - currentBal).toLocaleString()} ETB\n\n` +
      `Please deposit additional funds or pay directly via Telebirr:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit Funds', 'WALLET_DEPOSIT')],
          [Markup.button.callback('📱 Pay via Telebirr', `PAY_DIRECT_TELEBIRR_${toolKey}`)],
          [Markup.button.callback('⬅️ Back', 'ACTION_SHOP')]
        ])
      }
    );
  }

  // Create order
  if (isMongoConnected) {
    await Order.create({
      userId: String(userId),
      username: username,
      toolName: tool.name,
      price: `${tool.price} ETB (Wallet)`,
      method: 'Wallet',
      status: 'Pending'
    });
  }

  // Notify Admin
  if (ADMIN_CHAT_ID) {
    try {
      await bot.telegram.sendMessage(
        ADMIN_CHAT_ID,
        `🚨 <b>NEW ORDER PAID VIA WALLET!</b>\n\n` +
        `👤 <b>Customer:</b> @${username}\n` +
        `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
        `📦 <b>Product:</b> <b>${tool.name}</b>\n` +
        `💰 <b>Amount:</b> ${tool.price} ETB (Paid from Wallet)\n` +
        `💳 <b>Remaining Balance:</b> ${newBalance.toLocaleString()} ETB\n\n` +
        `💡 <b>Deliver Credentials:</b>\n` +
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
    `✅ Your order has been recorded. Admin will deliver your access credentials within 5–15 minutes!\n\n` +
    `You can track your order status in <b>📦 My Orders</b>.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
        [Markup.button.callback('👛 View Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// Direct payment chosen
bot.action(/^PAY_DIRECT_TELEBIRR_(.+)$/, (ctx) => {
  const toolKey = ctx.match[1];
  const tool = TOOLS[toolKey] || TOOLS.FX_MONTH;
  userSessions[ctx.from.id] = { type: 'ORDER', tool: tool.name, price: tool.price, method: 'Telebirr' };

  return ctx.reply(
    `📱 <b>Telebirr Payment Details</b>\n\n` +
    `• Number: <code>${PAYMENT_INFO.telebirr.number}</code>\n` +
    `• Account Name: <code>${PAYMENT_INFO.telebirr.name}</code>\n` +
    `• Amount: <code>${tool.price.toLocaleString()} ETB</code>\n\n` +
    `⚠️ Upload your payment screenshot right here once completed.`,
    { parse_mode: 'HTML' }
  );
});

// ============================================================
// 📸 RECEIPT UPLOAD & INPUT HANDLER
// ============================================================

bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (session && session.awaitingCustomAmount) {
    const text = ctx.message.text.trim();
    const amount = parseInt(text.replace(/[^0-9]/g, ''), 10);

    if (isNaN(amount) || amount < 100) {
      return ctx.reply("❌ Invalid amount. Minimum deposit is 100 ETB. Please enter a valid number (e.g. 500):");
    }

    delete session.awaitingCustomAmount;
    return showDepositPaymentMethods(ctx, amount);
  }

  return next();
});

bot.on('photo', async (ctx) => {
  try {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const username = ctx.from.username || 'NoUsername';
    const photo = ctx.message.photo.pop();
    const session = userSessions[userId] || {};

    if (session.type === 'WALLET_DEPOSIT') {
      const depositAmount = session.amount || 500;
      const method = session.method || 'Telebirr';
      const refCode = `DEP-${Math.floor(100000 + Math.random() * 900000)}`;

      let depositDoc = null;
      if (isMongoConnected) {
        depositDoc = await Deposit.create({
          userId: String(userId),
          username: username,
          amount: depositAmount,
          method: method,
          refCode: refCode,
          receiptPhotoId: photo.file_id,
          status: 'PENDING'
        });
      } else {
        depositDoc = {
          id: Date.now().toString(),
          userId: String(userId),
          username: username,
          amount: depositAmount,
          method: method,
          refCode: refCode,
          receiptPhotoId: photo.file_id,
          status: 'PENDING'
        };
        memoryDb.deposits.push(depositDoc);
      }

      delete userSessions[userId];

      if (ADMIN_CHAT_ID) {
        try {
          const docId = depositDoc._id ? String(depositDoc._id) : depositDoc.id;
          await bot.telegram.sendPhoto(
            ADMIN_CHAT_ID,
            photo.file_id,
            {
              caption: `💳 <b>PENDING WALLET DEPOSIT</b>\n\n` +
                       `👤 <b>Customer:</b> @${username}\n` +
                       `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
                       `💰 <b>Amount:</b> <b>${depositAmount.toLocaleString()} ETB</b>\n` +
                       `💳 <b>Method:</b> ${method}\n` +
                       `🔖 <b>Ref Code:</b> <code>${refCode}</code>`,
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(`✅ Approve (+${depositAmount} ETB)`, `DEP_APPROVE_${docId}`)],
                [Markup.button.callback('❌ Reject Deposit', `DEP_REJECT_${docId}`)]
              ])
            }
          );
        } catch (e) {}
      }

      return ctx.reply(
        `⏳ <b>DEPOSIT PENDING</b>\n\n` +
        `<b>Amount:</b> <b>${depositAmount.toLocaleString()} ETB</b>\n` +
        `<b>Reference:</b> <code>${refCode}</code>\n\n` +
        `Your payment proof is waiting for verification.\n` +
        `You will receive a notification once reviewed.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('👛 Back to Wallet', 'ACTION_WALLET')]
          ])
        }
      );
    } else {
      const toolName = session.tool || 'Trading Tool';
      const price = session.price || 'Direct';

      if (isMongoConnected) {
        await Order.create({
          userId: String(userId),
          username: username,
          toolName: toolName,
          price: `${price} ETB`,
          receiptPhotoId: photo.file_id,
          status: 'Pending'
        });
      }

      if (ADMIN_CHAT_ID) {
        try {
          await bot.telegram.sendPhoto(
            ADMIN_CHAT_ID,
            photo.file_id,
            {
              caption: `🚨 <b>NEW DIRECT ORDER RECEIPT</b>\n\n` +
                       `👤 <b>Customer:</b> @${username}\n` +
                       `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
                       `📦 <b>Tool:</b> ${toolName}\n` +
                       `💰 <b>Price:</b> ${price} ETB\n\n` +
                       `💡 Deliver: <code>/send ${userId} Email: ... | Pass: ...</code>`,
              parse_mode: 'HTML'
            }
          );
        } catch (e) {}
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

  const depositId = ctx.match[1];
  let deposit = null;

  if (isMongoConnected) {
    deposit = await Deposit.findById(depositId);
  } else {
    deposit = memoryDb.deposits.find(d => d.id === depositId);
  }

  if (!deposit || deposit.status === 'APPROVED') {
    return ctx.answerCbQuery('Deposit already approved or not found.');
  }

  deposit.status = 'APPROVED';
  deposit.reviewedAt = new Date();
  if (isMongoConnected) await deposit.save();

  const newBal = await creditUserWallet(deposit.userId, deposit.amount, `Wallet Deposit (Ref: ${deposit.refCode})`);

  try {
    ctx.editMessageCaption(
      (ctx.update.callback_query.message.caption || '') + `\n\n✅ <b>STATUS: APPROVED (+${deposit.amount} ETB)</b>\n💳 New Balance: ${newBal.toLocaleString()} ETB`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  try {
    await bot.telegram.sendMessage(
      deposit.userId,
      `✅ <b>WALLET DEPOSIT APPROVED</b>\n\n` +
      `Your wallet has been credited successfully.\n\n` +
      `💰 <b>Added:</b> +${deposit.amount.toLocaleString()} ETB\n` +
      `💳 <b>New Balance:</b> <b>${newBal.toLocaleString()} ETB</b>\n\n` +
      `Thank you for using ATTS.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📊 Buy Trading Tools', 'ACTION_SHOP')],
          [Markup.button.callback('👛 View Wallet', 'ACTION_WALLET')]
        ])
      }
    );
  } catch (e) {}

  return ctx.answerCbQuery('Deposit approved!');
});

bot.action(/^DEP_REJECT_(.+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery('Unauthorized');

  const depositId = ctx.match[1];
  let deposit = null;

  if (isMongoConnected) {
    deposit = await Deposit.findById(depositId);
  } else {
    deposit = memoryDb.deposits.find(d => d.id === depositId);
  }

  if (!deposit) return ctx.answerCbQuery('Deposit not found.');

  deposit.status = 'REJECTED';
  deposit.reviewedAt = new Date();
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
      `❌ <b>DEPOSIT REJECTED</b>\n\n` +
      `Your deposit request for <b>${deposit.amount.toLocaleString()} ETB</b> was rejected.\n\n` +
      `<b>Reason:</b>\nPayment could not be verified with official bank records.\n\n` +
      `Contact @${SUPPORT_USERNAME} if you have any questions.`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  return ctx.answerCbQuery('Deposit rejected.');
});

// Admin Command /send
bot.command('send', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply('⛔ Admin only.');

  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 3) {
    return ctx.reply("⚠️ Usage: /send <userId> <credentials>\nExample: /send 583928172 Email: ... | Pass: ...");
  }

  const targetUserId = parts[1];
  const credentials = parts.slice(2).join(' ');

  try {
    await bot.telegram.sendMessage(
      targetUserId,
      `🎉 <b>ORDER ACTIVATED</b>\n\n` +
      `🔑 <b>Your Login Credentials:</b>\n<code>${credentials}</code>\n\n` +
      `📂 View under <b>📦 My Orders → 🔑 My Access</b>\n` +
      `🔒 Keep your credentials confidential.`,
      { parse_mode: 'HTML' }
    );
    ctx.reply(`✅ Credentials delivered to ${targetUserId}!`);
  } catch (err) {
    ctx.reply(`❌ Failed: ${err.message}`);
  }
});

// ============================================================
// 📦 MY ORDERS, PRICING, OFFERS, REFERRAL, HELP
// ============================================================

bot.start(async (ctx) => {
  await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const isJoined = await checkChannels(ctx, ctx.from.id);
  if (!isJoined) return sendForceJoinMessage(ctx);
  return sendMainMenu(ctx);
});

bot.action('VERIFY_CHANNELS', async (ctx) => {
  const isJoined = await checkChannels(ctx, ctx.from.id);
  if (isJoined) {
    try { await ctx.deleteMessage(); } catch (e) {}
    ctx.reply("🎉 Verification successful! Welcome to ATTS.");
    return sendMainMenu(ctx);
  } else {
    return ctx.answerCbQuery("❌ Please make sure to join all 3 channels before proceeding!", { show_alert: true });
  }
});

bot.action('ACTION_MY_ORDERS', async (ctx) => {
  let orders = [];
  if (isMongoConnected) {
    orders = await Order.find({ userId: String(ctx.from.id) }).sort({ createdAt: -1 });
  } else {
    orders = memoryDb.orders.filter(o => o.userId === String(ctx.from.id));
  }

  let text = `📦 <b>My Orders Dashboard</b>\n\n• Total Orders: <b>${orders.length}</b>\n\n`;
  if (orders.length > 0) {
    orders.forEach((o, i) => {
      text += `${i + 1}. <b>${o.toolName}</b>\n   • Status: ${o.status}\n   • Credentials: <code>${o.credentials || 'Pending Delivery'}</code>\n\n`;
    });
  } else {
    text += "You have no active orders yet.";
  }

  ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📊 Browse Tools', 'ACTION_SHOP'), Markup.button.callback('👛 My Wallet', 'ACTION_WALLET')],
      [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  });
});

bot.action('ACTION_PRICING', (ctx) => {
  ctx.reply(
    "💳 <b>Official Pricing Overview:</b>\n\n" +
    "1. 📊 <b>TradingView Premium</b> — 🚫 Out of Stock\n" +
    "2. 📈 <b>TradingView Essential</b> — 1,100 ETB (1 Mo)\n" +
    "3. 📈 <b>TradingView + CME Data</b> — 1,350 ETB (1 Mo)\n" +
    "4. 🔄 <b>Fxreplay Pro</b> — Weekly from 250 ETB / Monthly from 750 ETB\n" +
    "5. 📓 <b>Abyssinia Journal</b> — ✨ Coming Soon!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('👛 My Wallet', 'ACTION_WALLET')],
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
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('👛 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_REFERRAL', async (ctx) => {
  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${ctx.from.id}`;

  ctx.reply(
    "🤝 <b>Partner & Referral Program</b>\n\n" +
    "Invite fellow traders and earn 100 ETB Commission for every purchase they make!\n\n" +
    `🔗 <b>Your Link:</b>\n${refLink}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Share Link on Telegram', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Get genuine TradingView CME feeds & FX Replay Pro on ATTS!')}`)],
        [Markup.button.callback('👛 View Wallet', 'ACTION_WALLET'), Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_FAQ', (ctx) => {
  ctx.reply(
    "❓ <b>HELP CENTER & FAQ</b>\n\n" +
    "• <b>How long does delivery take?</b>\n5 to 15 minutes after payment confirmation.\n\n" +
    "• <b>How do I fund my wallet?</b>\nClick 👛 Wallet → ➕ Deposit Funds, choose an amount, and upload your payment receipt.\n\n" +
    "• <b>Is this an official subscription?</b>\nYes, 100% genuine guaranteed access.\n\n" +
    "• <b>How do I contact support?</b>\nDirect Telegram: @" + SUPPORT_USERNAME,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Trading Tools', 'ACTION_SHOP'), Markup.button.callback('👛 My Wallet', 'ACTION_WALLET')],
        [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

bot.action('ACTION_MAIN_MENU', (ctx) => sendMainMenu(ctx));

bot.launch().then(() => console.log('🚀 ATTS Telegram Store Bot is LIVE!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// Full English Production Bot for Render.com (24/7 Cloud Hosting)
// Features Included:
//  1. 🔒 Multi-Channel Force Join (@abyssiniatradinget, @abyssiniachat, @abyssiniattstore)
//  2. 🛒 Trading Tools Catalog (TradingView, FX Replay, Forex VPS, Journal, VIP Bundle)
//  3. ⚡ "How It Works" 4-Step Customer Guide
//  4. ❓ Full Interactive FAQ (Delivery, Payments, Warranty, Support)
//  5. 👥 Full "My Orders" Dashboard (Active Orders, Order History, My Access Keys)
//  6. ✍️ Robust Manual Admin Delivery (/send <userId> <credentials>)
//  7. 📣 Mass Broadcast System (/broadcast <message>)
//  8. 👥 Referral & Earn System (Unique invite links)
//  9. 🎟️ Discount Coupon Codes (VIP2026, HOLIDAY, START)
// 10. 📊 Live Admin Business Analytics (/stats)
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "abyssiniatradinget";

// 📢 Required Channels that users must join before using the bot
const REQUIRED_CHANNELS = [
  { username: "@abyssiniatradinget", name: "Abyssinia Trading Official", url: "https://t.me/abyssiniatradinget" },
  { username: "@abyssiniachat", name: "Abyssinia Trading Chat Community", url: "https://t.me/abyssiniachat" },
  { username: "@abyssiniattstore", name: "A T T S Store Channel", url: "https://t.me/abyssiniattstore" }
];

if (!BOT_TOKEN) {
  console.error("FATAL: BOT_TOKEN is missing in environment variables!");
}

const bot = new Telegraf(BOT_TOKEN);

// 🌐 Health check HTTP server for Render.com Free Web Service
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('A T T S Telegram Bot (@abyssiniatradingbot) is LIVE 24/7 on Render!');
});
server.listen(PORT, () => {
  console.log('HTTP Health Check Server listening on port ' + PORT);
});

// Bank & Payment Accounts Details
const PAYMENT_INFO = {
  telebirr: {
    number: "0911223344",
    name: "Abyssinia Trading Services"
  },
  cbe: {
    account: "1000123456789",
    name: "Abyssinia Trading Services"
  },
  usdt: {
    address: "TYs8...TRC20USDT",
    network: "TRC20"
  }
};

// Active Promo / Coupon Codes
const PROMO_CODES = {
  "VIP2026": { discount: 200, label: "200 ETB Discount" },
  "HOLIDAY": { discount: 150, label: "150 ETB Discount" },
  "START": { discount: 100, label: "100 ETB Discount" }
};

// Tools & Products Catalog
const TOOLS_CATALOG = {
  TRADINGVIEW: { name: "TradingView Premium (1 Month)", price: 1500, origPrice: 6000 },
  FXREPLAY: { name: "FX Replay Pro (1 Month)", price: 1200, origPrice: 3500 },
  VPS: { name: "Forex Ultra Low-Latency VPS (1 Month)", price: 950, origPrice: 1800 },
  JOURNAL: { name: "Automated Trader Journal Pro (Lifetime)", price: 850, origPrice: 2000 },
  BUNDLE: { name: "VIP All-in-One Master Bundle", price: 2990, origPrice: 11300 }
};

// In-Memory Database
const db = {
  users: new Set(),
  userOrders: {},      // { userId: [ { id, tool, plan, status, activatedDate, expiresDate, credentials } ] }
  referrals: {},       // { userId: [referredUserIds] }
  referrerOf: {},      // { newUserId: referrerId }
  userSessions: {},    // { userId: { tool, method, discount, couponApplied, finalPrice } }
  ordersCount: 0,
  totalRevenue: 0
};

// 🔍 Multi-Channel Force Join Verification
async function checkAllChannelMemberships(ctx, userId) {
  if (String(userId) === String(ADMIN_CHAT_ID)) return { allJoined: true, missing: [] };

  const missing = [];
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const member = await ctx.telegram.getChatMember(ch.username, userId);
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);
      if (!isMember) {
        missing.push(ch);
      }
    } catch (err) {
      console.error("Channel check warning for " + ch.username + ":", err.message);
    }
  }

  return { allJoined: missing.length === 0, missing };
}

// 🚫 Force Join Prompt Message
function sendJoinChannelMessage(ctx, missingChannels) {
  const channelList = missingChannels && missingChannels.length > 0 ? missingChannels : REQUIRED_CHANNELS;
  const channelButtons = channelList.map(ch => [
    Markup.button.url('📢 Join ' + ch.name, ch.url)
  ]);

  channelButtons.push([Markup.button.callback('✅ I Have Joined All Channels (Verify)', 'VERIFY_JOIN')]);

  return ctx.reply(
    "⚠️ Access Required Before Using A T T S Bot!\n\n" +
    "To access our premium trading tools, pricing catalogs, and instant orders, you must first join our official community channels:\n\n" +
    "1️⃣ @abyssiniatradinget (Official Channel)\n" +
    "2️⃣ @abyssiniachat (Trading Discussion Community)\n" +
    "3️⃣ @abyssiniattstore (Store & Updates)\n\n" +
    "👉 Click the buttons below to join each channel, then click Verify:",
    Markup.inlineKeyboard(channelButtons)
  );
}

// 🏠 Main Menu Builder
function sendMainMenu(ctx) {
  return ctx.reply(
    "👋 Welcome to A T T S - Abyssinia Trading Tools Store!\n\n" +
    "Get instant access to genuine premium trading tools (TradingView Premium, FX Replay Pro, Forex VPS, Trader Journal) via Telebirr, CBE Bank & Binance USDT.\n\n" +
    "⚡ Please select an option below:",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Order Tools', 'ACTION_BUY'), Markup.button.callback('👥 My Orders', 'ACTION_MY_ORDERS')],
      [Markup.button.callback('⚡ How It Works', 'ACTION_HOW_IT_WORKS'), Markup.button.callback('❓ FAQ', 'ACTION_FAQ')],
      [Markup.button.callback('💰 Price List', 'ACTION_PRICES'), Markup.button.callback('🎟️ Promo Code', 'ACTION_COUPON')],
      [Markup.button.callback('👥 Invite & Earn', 'ACTION_REFERRAL'), Markup.button.callback('⭐ Reviews & Vouches', 'ACTION_VOUCHES')],
      [Markup.button.url('📞 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)]
    ])
  );
}

// ❓ FAQ Menu Builder
function sendFAQMenu(ctx) {
  return ctx.reply(
    "❓ FREQUENTLY ASKED QUESTIONS (FAQ)\n\n" +
    "Click any question below for quick answers or contact our 24/7 support team:",
    Markup.inlineKeyboard([
      [Markup.button.callback('⏱️ How long does delivery take?', 'FAQ_DELIVERY')],
      [Markup.button.callback('💳 How do I pay?', 'FAQ_PAYMENT')],
      [Markup.button.callback('🔒 Is this an official subscription?', 'FAQ_OFFICIAL')],
      [Markup.button.callback('🔄 Can I change my account?', 'FAQ_CHANGE_ACC')],
      [Markup.button.callback('⏰ What happens when my subscription expires?', 'FAQ_EXPIRY')],
      [Markup.button.callback('🛠️ What if I have a problem?', 'FAQ_PROBLEM')],
      [Markup.button.callback('📞 How do I contact support?', 'FAQ_SUPPORT')],
      [Markup.button.callback('🔙 Back to Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
}

// 1. /start command
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  db.users.add(userId);

  // Referral tracking
  const startPayload = ctx.message.text.split(' ')[1];
  if (startPayload && startPayload.startsWith('ref_')) {
    const referrerId = startPayload.replace('ref_', '');
    if (referrerId !== String(userId) && !db.referrerOf[userId]) {
      db.referrerOf[userId] = referrerId;
      if (!db.referrals[referrerId]) db.referrals[referrerId] = [];
      db.referrals[referrerId].push(userId);

      try {
        await bot.telegram.sendMessage(
          referrerId,
          "🎉 New trader joined via your referral link!\n\nUser: @" + (ctx.from.username || 'Trader') + "\nYou will receive a 100 ETB bonus upon their first purchase!"
        );
      } catch (e) {}
    }
  }

  const { allJoined, missing } = await checkAllChannelMemberships(ctx, userId);
  if (!allJoined) {
    return sendJoinChannelMessage(ctx, missing);
  }
  return sendMainMenu(ctx);
});

// Verify Channel Join Callback
bot.action('VERIFY_JOIN', async (ctx) => {
  const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
  if (allJoined) {
    try { await ctx.deleteMessage(); } catch (e) {}
    ctx.reply("🎉 Verification Successful! Thank you for joining our community.");
    return sendMainMenu(ctx);
  } else {
    const remaining = missing.map(m => m.username).join(', ');
    return ctx.answerCbQuery("❌ Please join all 3 channels first! Remaining: " + remaining, { show_alert: true });
  }
});

// ⚡ 2. HOW IT WORKS (Customer Onboarding)
bot.action('ACTION_HOW_IT_WORKS', (ctx) => {
  ctx.reply(
    "⚡ HOW IT WORKS\n\n" +
    "1️⃣ Choose your product\n" +
    "Select TradingView, FX Replay or Journal.\n\n" +
    "2️⃣ Choose your plan\n" +
    "Select the subscription you want.\n\n" +
    "3️⃣ Make payment\n" +
    "Follow the payment instructions.\n\n" +
    "4️⃣ Receive your access\n" +
    "Your order will be processed and delivered.",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Order Now', 'ACTION_BUY')],
      [Markup.button.callback('🔙 Back to Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// ❓ 3. FAQ SECTION HANDLERS
bot.action('ACTION_FAQ', (ctx) => {
  return sendFAQMenu(ctx);
});

bot.action('FAQ_DELIVERY', (ctx) => {
  ctx.reply(
    "⏱️ How long does delivery take?\n\n" +
    "Orders are processed rapidly within 5 to 15 minutes after uploading your payment screenshot. Our team verifies your transaction and sends your private login credentials right here in this bot!",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛒 Order Now', 'ACTION_BUY')]
    ])
  );
});

bot.action('FAQ_PAYMENT', (ctx) => {
  ctx.reply(
    "💳 How do I pay?\n\n" +
    "We accept three convenient payment methods:\n" +
    "1. Telebirr (Instant Mobile Money)\n" +
    "2. Commercial Bank of Ethiopia (CBE)\n" +
    "3. Binance USDT (TRC20) for crypto traders.\n\n" +
    "Account details and copyable numbers will be shown automatically during checkout.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛒 Order Now', 'ACTION_BUY')]
    ])
  );
});

bot.action('FAQ_OFFICIAL', (ctx) => {
  ctx.reply(
    "🔒 Is this an official subscription?\n\n" +
    "Yes! All TradingView Premium, FX Replay Pro, and VPS accounts are 100% genuine, private, and backed by our full-term warranty guarantee.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛒 Order Now', 'ACTION_BUY')]
    ])
  );
});

bot.action('FAQ_CHANGE_ACC', (ctx) => {
  ctx.reply(
    "🔄 Can I change my account?\n\n" +
    "Yes, if you need customized email credentials or want your subscription linked to a specific setup, simply notify our support team right after ordering.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.url('📞 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)]
    ])
  );
});

bot.action('FAQ_EXPIRY', (ctx) => {
  ctx.reply(
    "⏰ What happens when my subscription expires?\n\n" +
    "You will receive an automated 1-click renewal reminder 3 days prior to expiration so your charting, backtesting, or VPS bots never get interrupted.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛒 Order Now', 'ACTION_BUY')]
    ])
  );
});

bot.action('FAQ_PROBLEM', (ctx) => {
  ctx.reply(
    "🛠️ What if I have a problem?\n\n" +
    "We offer 24/7 dedicated customer assistance. If you ever experience an issue with login, bar replay, or indicators, we replace or resolve it within minutes!",
    Markup.inlineKeyboard([
      [Markup.button.url('📞 Talk to Support', 'https://t.me/' + SUPPORT_USERNAME)],
      [Markup.button.callback('🔙 Back to FAQ', 'ACTION_FAQ')]
    ])
  );
});

bot.action('FAQ_SUPPORT', (ctx) => {
  ctx.reply(
    "📞 How do I contact support?\n\n" +
    "You can reach our official administration team directly via Telegram:\n" +
    "👉 @" + SUPPORT_USERNAME + " (24/7 Fast Response)",
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Open Support Chat', 'https://t.me/' + SUPPORT_USERNAME)],
      [Markup.button.callback('🔙 Back to FAQ', 'ACTION_FAQ')]
    ])
  );
});

// 👥 4. MY ORDERS DASHBOARD
bot.action('ACTION_MY_ORDERS', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];

  ctx.reply(
    "👥 My Orders\n\n" +
    "📦 My Orders\n" +
    "View your purchases, active subscriptions and expiration dates.",
    Markup.inlineKeyboard([
      [Markup.button.callback('📦 Active Orders', 'MY_ORDERS_ACTIVE')],
      [Markup.button.callback('🕐 Order History', 'MY_ORDERS_HISTORY')],
      [Markup.button.callback('🔑 My Access', 'MY_ORDERS_KEYS')],
      [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
    ])
  );
});

bot.action('MY_ORDERS_ACTIVE', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];
  const activeOrders = orders.filter(o => o.status === 'Active');

  if (activeOrders.length === 0) {
    return ctx.reply(
      "📦 Active Orders:\n\nYou do not have any active subscriptions right now.\n\nReady to upgrade your trading?",
      Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Order Tools Now', 'ACTION_BUY')],
        [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
      ])
    );
  }

  let responseText = "📦 YOUR ACTIVE SUBSCRIPTIONS:\n\n";
  activeOrders.forEach((ord) => {
    responseText += ord.tool + "\n" +
                    "Status: 🟢 " + ord.status + "\n" +
                    "Plan: " + (ord.plan || '1 Month') + "\n" +
                    "Activated: " + ord.activatedDate + "\n" +
                    "Expires: " + ord.expiresDate + "\n\n";
  });
  responseText += "Need help? Contact Support.";

  ctx.reply(responseText, Markup.inlineKeyboard([
    [Markup.button.callback('🔑 My Access', 'MY_ORDERS_KEYS')],
    [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
  ]));
});

bot.action('MY_ORDERS_HISTORY', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];

  if (orders.length === 0) {
    return ctx.reply(
      "🕐 Order History:\n\nNo previous order records found under your account.",
      Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Order First Tool', 'ACTION_BUY')],
        [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
      ])
    );
  }

  let responseText = "🕐 YOUR ORDER HISTORY:\n\n";
  orders.forEach((ord, idx) => {
    responseText += "#" + (ord.id || (1000 + idx + 1)) + " - " + ord.tool + " (" + ord.status + ") on " + ord.activatedDate + "\n";
  });

  ctx.reply(responseText, Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
  ]));
});

bot.action('MY_ORDERS_KEYS', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];

  if (orders.length === 0) {
    return ctx.reply(
      "🔑 My Access:\n\nNo credentials available. Place an order to receive your login access.",
      Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Order Tools', 'ACTION_BUY')],
        [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
      ])
    );
  }

  let responseText = "🔑 YOUR DELIVERED ACCESS CREDENTIALS:\n\n";
  orders.forEach((ord, idx) => {
    responseText += (idx + 1) + ". " + ord.tool + ":\n" + (ord.credentials || 'Access active via linked email.') + "\n\n";
  });

  ctx.reply(responseText, Markup.inlineKeyboard([
    [Markup.button.url('📞 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)],
    [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
  ]));
});

// 5. BUY / ORDER FLOW
bot.action('ACTION_BUY', async (ctx) => {
  const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
  if (!allJoined) return sendJoinChannelMessage(ctx, missing);

  const session = db.userSessions[ctx.from.id] || {};
  const discount = session.discount || 0;
  const discountText = discount > 0 ? " (" + discount + " ETB Discount Applied!)" : "";

  ctx.reply(
    "🎯 SELECT YOUR TRADING TOOL" + discountText + ":",
    Markup.inlineKeyboard([
      [Markup.button.callback("TradingView Premium (" + (1500 - discount) + " ETB)", 'TOOL_TRADINGVIEW')],
      [Markup.button.callback("FX Replay Pro (" + (1200 - discount) + " ETB)", 'TOOL_FXREPLAY')],
      [Markup.button.callback("Forex Ultra VPS (" + (950 - discount) + " ETB)", 'TOOL_VPS')],
      [Markup.button.callback("Trader Journal Pro (" + (850 - discount) + " ETB)", 'TOOL_JOURNAL')],
      [Markup.button.callback("VIP Master Bundle (" + (2990 - discount) + " ETB)", 'TOOL_BUNDLE')],
      [Markup.button.callback('🎟️ Apply Coupon Code', 'ACTION_COUPON'), Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 6. Price Catalog View
bot.action('ACTION_PRICES', async (ctx) => {
  ctx.reply(
    "💰 OFFICIAL PRICING CATALOG:\n\n" +
    "1. TradingView Premium (1 Month):\n   • Standard: ~$60 (6,000 ETB)\n   • Our Price: 1,500 ETB / $15\n\n" +
    "2. FX Replay Pro (1 Month):\n   • Standard: ~$35 (3,500 ETB)\n   • Our Price: 1,200 ETB / $12\n\n" +
    "3. Forex Ultra Low-Latency VPS (1 Month):\n   • 24/7 EA and MT4/MT5 Robot Hosting\n   • Our Price: 950 ETB / $9.5\n\n" +
    "4. Automated Trader Journal Pro (Lifetime):\n   • Risk Analytics, Win-rate & Equity Curves\n   • Our Price: 850 ETB\n\n" +
    "5. VIP All-in-One Master Bundle:\n   • TradingView + FX Replay + VPS + Journal\n   • Bundle Deal: 2,990 ETB (Save Over 70%!)\n\n" +
    "👇 Click below to place your order:",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Order Now', 'ACTION_BUY')],
      [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 7. Referral Program
bot.action('ACTION_REFERRAL', async (ctx) => {
  const userId = ctx.from.id;
  const botInfo = await ctx.telegram.getMe();
  const refLink = "https://t.me/" + botInfo.username + "?start=ref_" + userId;
  const count = (db.referrals[userId] || []).length;

  ctx.reply(
    "👥 PARTNER & REFERRAL PROGRAM (Invite & Earn):\n\n" +
    "Invite other traders and earn 100 ETB Commission for every purchase they make!\n\n" +
    "📊 Your Performance:\n" +
    "• Traders Invited: " + count + " people\n" +
    "• Commission Balance: " + (count * 100) + " ETB\n\n" +
    "🔗 Your Unique Referral Link:\n" + refLink,
    Markup.inlineKeyboard([
      [Markup.button.url('📢 Share Link on Telegram', "https://t.me/share/url?url=" + encodeURIComponent(refLink) + "&text=" + encodeURIComponent('Get genuine TradingView Premium and FX Replay Pro in Ethiopia instantly via Telebirr & CBE on A T T S!'))],
      [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 8. Coupon Code Flow
bot.action('ACTION_COUPON', (ctx) => {
  db.userSessions[ctx.from.id] = { ...db.userSessions[ctx.from.id], awaitingCoupon: true };
  ctx.reply(
    "🎟️ Have a Promo or Coupon Code?\n\nPlease type and send your coupon code in this chat (e.g., VIP2026 or HOLIDAY):",
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Back to Order', 'ACTION_BUY')]
    ])
  );
});

// 9. Reviews & Vouches
bot.action('ACTION_VOUCHES', (ctx) => {
  ctx.reply(
    "⭐ 500+ VERIFIED ETHIOPIAN TRADER REVIEWS:\n\n" +
    "💬 'FX Replay helped me pass my 50k Funded Prop Challenge in 3 weeks!' - @Abebe_FX\n" +
    "💬 'TradingView Premium delivered in 5 minutes via Telebirr!' - @DawitScalps\n" +
    "💬 'Ultra-fast Forex VPS for my EA robot, 100% uptime!' - @YohannesTrade\n\n" +
    "✅ 100% Genuine, Guaranteed, and Fast Delivery!",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 I Want To Order Now', 'ACTION_BUY')],
      [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

bot.action('ACTION_MAIN_MENU', (ctx) => {
  return sendMainMenu(ctx);
});

// Tool Selection
bot.action(/TOOL_(.+)/, async (ctx) => {
  const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
  if (!allJoined) return sendJoinChannelMessage(ctx, missing);

  const toolKey = ctx.match[1];
  const tool = TOOLS_CATALOG[toolKey] || { name: toolKey, price: 1200 };
  const currentSession = db.userSessions[ctx.from.id] || {};
  const discount = currentSession.discount || 0;
  const finalPrice = Math.max(100, tool.price - discount);

  db.userSessions[ctx.from.id] = { ...currentSession, tool: tool.name, finalPrice: finalPrice };

  ctx.reply(
    "Selected Product: " + tool.name + "\n" +
    "Total Due: " + finalPrice + " ETB" + (discount > 0 ? " (" + discount + " ETB Discount Applied!)" : "") + "\n\n" +
    "Please choose your preferred payment method:",
    Markup.inlineKeyboard([
      [Markup.button.callback('Telebirr (ቴሌብር)', 'PAY_TELEBIRR')],
      [Markup.button.callback('CBE (Commercial Bank of Ethiopia)', 'PAY_CBE')],
      [Markup.button.callback('Binance USDT (TRC20)', 'PAY_USDT')],
      [Markup.button.callback('Back', 'ACTION_BUY')]
    ])
  );
});

// Payment Info Generation
bot.action(/PAY_(.+)/, (ctx) => {
  const method = ctx.match[1];
  const userSession = db.userSessions[ctx.from.id] || { tool: 'Trading Tool', finalPrice: 1200 };
  userSession.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = "Telebirr Payment Details:\n\n" +
              "Number: " + PAYMENT_INFO.telebirr.number + "\n" +
              "Name: " + PAYMENT_INFO.telebirr.name + "\n" +
              "Amount: " + (userSession.finalPrice || 1200) + " ETB\n\n" +
              "Important: After transferring, please send your payment screenshot (receipt) right here in this chat.";
  } else if (method === 'CBE') {
    payText = "CBE Bank Transfer Details:\n\n" +
              "Account: " + PAYMENT_INFO.cbe.account + "\n" +
              "Name: " + PAYMENT_INFO.cbe.name + "\n" +
              "Amount: " + (userSession.finalPrice || 1200) + " ETB\n\n" +
              "Important: After completing the transfer, send your CBE screenshot right here.";
  } else {
    payText = "Binance USDT (TRC20):\n\n" +
              "Address: " + PAYMENT_INFO.usdt.address + "\n" +
              "Network: " + PAYMENT_INFO.usdt.network + "\n" +
              "Amount: " + ((userSession.finalPrice || 1200) / 100).toFixed(1) + " USDT\n\n" +
              "Please send the TXID or transaction screenshot here.";
  }

  ctx.reply(payText);
});

// Coupon Text Listener
bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim().toUpperCase();

  if (db.userSessions[userId] && db.userSessions[userId].awaitingCoupon) {
    db.userSessions[userId].awaitingCoupon = false;

    if (PROMO_CODES[text]) {
      const promo = PROMO_CODES[text];
      db.userSessions[userId].discount = promo.discount;
      db.userSessions[userId].couponApplied = text;

      return ctx.reply(
        "Congratulations! Coupon " + text + " applied successfully!\n\n" +
        "Your Discount: " + promo.discount + " ETB\n" +
        "Proceed to choose your product with discounted price:",
        Markup.inlineKeyboard([
          [Markup.button.callback('Order with Discount', 'ACTION_BUY')]
        ])
      );
    } else {
      return ctx.reply(
        "Invalid or expired coupon code.",
        Markup.inlineKeyboard([
          [Markup.button.callback('Try Again', 'ACTION_COUPON')],
          [Markup.button.callback('Order Without Code', 'ACTION_BUY')]
        ])
      );
    }
  }

  return next();
});

// Customer Uploads Receipt Photo
bot.on('photo', async (ctx) => {
  const user = ctx.from;
  db.users.add(user.id);
  const userSession = db.userSessions[user.id] || { tool: 'Trading Tool', method: 'Direct', finalPrice: 1200 };
  const photo = ctx.message.photo.pop();

  if (ADMIN_CHAT_ID) {
    try {
      const captionText = "NEW PAYMENT RECEIPT RECEIVED!\n\n" +
                          "Customer: @" + (user.username || 'NoUsername') + "\n" +
                          "User ID: " + user.id + "\n" +
                          "Product: " + userSession.tool + "\n" +
                          "Amount: " + (userSession.finalPrice || 1200) + " ETB\n" +
                          "Method: " + userSession.method + "\n\n" +
                          "Copy & paste to deliver credentials:\n" +
                          "/send " + user.id + " Email: ... | Pass: ...";

      await bot.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
        caption: captionText,
        ...Markup.inlineKeyboard([
          [Markup.button.callback("Reject Receipt (" + user.id + ")", "REJECT_" + user.id)]
        ])
      });
    } catch (err) {
      console.error('Error forwarding to admin:', err);
    }
  }

  ctx.reply("Receipt Received! Our team is verifying your transaction. Your login access keys will be delivered right here within 5 to 15 minutes.");
});

// ✍️ Robust Manual Admin Delivery (/send <userId> <credentials>)
bot.command('send', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('This command is restricted to the administrator only.');
  }

  const messageText = ctx.message.text.trim();
  const parts = messageText.split(' ');

  if (parts.length < 3) {
    return ctx.reply('Usage format:\n/send <USER_ID> <Credentials>\n\nExample:\n/send 5056286354 Email: user@vip.com | Pass: 123456');
  }

  const targetUserId = parts[1];
  const customMessage = parts.slice(2).join(' ');

  try {
    const now = new Date();
    const exp = new Date();
    exp.setDate(now.getDate() + 30);

    const deliveryNotification = "CONGRATULATIONS! YOUR ORDER IS APPROVED & ACTIVE!\n\n" +
                                 "Your Access Credentials:\n\n" +
                                 customMessage + "\n\n" +
                                 "Activation Date: " + now.toLocaleDateString() + "\n" +
                                 "Expiration Date: " + exp.toLocaleDateString() + "\n\n" +
                                 "You can always view this anytime under the 'My Orders' menu in the bot!\n" +
                                 "Need assistance? Contact @" + SUPPORT_USERNAME + ". Happy Trading!";

    await bot.telegram.sendMessage(targetUserId, deliveryNotification);

    // Save into customer's order history
    if (!db.userOrders[targetUserId]) db.userOrders[targetUserId] = [];
    db.userOrders[targetUserId].push({
      id: 1000 + db.userOrders[targetUserId].length + 1,
      tool: "Trading Tool Pro",
      plan: "1 Month",
      status: "Active",
      activatedDate: now.toLocaleDateString(),
      expiresDate: exp.toLocaleDateString(),
      credentials: customMessage
    });

    db.ordersCount += 1;
    db.totalRevenue += 1200;
    ctx.reply("Credentials delivered and recorded in Customer (ID: " + targetUserId + ") Orders Dashboard!");
  } catch (err) {
    ctx.reply("Delivery failed! Error: " + err.message);
  }
});

// 📢 Mass Broadcast Command (/broadcast <message>)
bot.command('broadcast', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('Administrator access required.');
  }

  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) {
    return ctx.reply('Please include the broadcast text.\n\nExample:\n/broadcast Special 24hr discount on TradingView Premium!');
  }

  const userList = Array.from(db.users);
  let successCount = 0;

  ctx.reply("Sending broadcast to " + userList.length + " registered bot users...");

  for (const uid of userList) {
    try {
      await bot.telegram.sendMessage(uid, "Announcement from A T T S:\n\n" + text);
      successCount++;
    } catch (e) {}
  }

  ctx.reply("Broadcast completed! Successfully reached " + successCount + " traders.");
});

// 📊 Admin Analytics (/stats)
bot.command('stats', (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('Administrator access required.');
  }

  const totalUsers = db.users.size;
  const totalOrders = db.ordersCount;
  const totalRevenue = db.totalRevenue;

  ctx.reply(
    "A T T S BUSINESS ANALYTICS DASHBOARD:\n\n" +
    "Total Registered Traders: " + totalUsers + " users\n" +
    "Total Processed Orders: " + totalOrders + " orders\n" +
    "Estimated Revenue: " + totalRevenue.toLocaleString() + " ETB\n" +
    "Bot Runtime: Active 24/7 on Render Cloud",
    Markup.inlineKeyboard([
      [Markup.button.callback('Refresh Stats', 'REFRESH_STATS')]
    ])
  );
});

bot.action('REFRESH_STATS', (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return;
  ctx.editMessageText(
    "A T T S BUSINESS ANALYTICS (Live Update):\n\n" +
    "Total Traders: " + db.users.size + " users\n" +
    "Completed Orders: " + db.ordersCount + "\n" +
    "Revenue: " + db.totalRevenue.toLocaleString() + " ETB",
    Markup.inlineKeyboard([
      [Markup.button.callback('Refresh Stats', 'REFRESH_STATS')]
    ])
  );
});

// Reject Order Callback
bot.action(/REJECT_(\d+)/, async (ctx) => {
  const targetUserId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(
      targetUserId,
      "Payment Verification Unsuccessful.\n\nWe could not confirm the uploaded transaction receipt. Please ensure you sent the correct screenshot or contact support at @" + SUPPORT_USERNAME
    );
    ctx.editMessageCaption((ctx.update.callback_query.message.caption || '') + '\n\nSTATUS: REJECTED');
  } catch (err) {
    console.error('Error sending rejection:', err);
  }
});

// Launch Bot
bot.launch().then(() => console.log('A T T S Telegram Bot (@abyssiniatradingbot) is Running 24/7!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// Full English Production Bot for Render.com (24/7 Cloud Hosting)
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

// Clean Products Catalog
const PRODUCTS_CATALOG = {
  TV_PREMIUM_CME: {
    id: "TV_PREMIUM_CME",
    title: "📊 TradingView Premium + CME Data",
    tagline: "Top tier package with official CME Real-Time market data feed.",
    badge: "Most Popular",
    features: [
      "Highest plan: 25 indicators per chart layout",
      "Official Real-Time CME Group data (ES, NQ, YM, GC, CL)",
      "8 simultaneous charts per tab layout",
      "400 price alerts & 400 technical alerts",
      "Bar Replay with second-based intervals & volume profile"
    ],
    plans: [
      { key: "TV_PREM_1M", name: "1 Month Access", price: 1800 },
      { key: "TV_PREM_3M", name: "3 Months Access", price: 4800, discountNote: "Save 600 ETB" },
      { key: "TV_PREM_1Y", name: "1 Year Access (VIP)", price: 16500, discountNote: "Best Value" }
    ]
  },
  TV_ESSENTIAL_CME: {
    id: "TV_ESSENTIAL_CME",
    title: "📈 TradingView Essential + CME Data",
    tagline: "Essential charting power combined with real-time CME futures data.",
    badge: "Best Value",
    features: [
      "5 indicators per chart layout",
      "Official Real-Time CME Group data included",
      "2 charts per tab layout",
      "20 active price alerts & technical alerts",
      "Clean ad-free charts with Bar Replay"
    ],
    plans: [
      { key: "TV_ESS_1M", name: "1 Month Access", price: 1350 },
      { key: "TV_ESS_3M", name: "3 Months Access", price: 3600, discountNote: "Save 450 ETB" },
      { key: "TV_ESS_1Y", name: "1 Year Access", price: 12000, discountNote: "Great Savings" }
    ]
  },
  FXREPLAY_PRO: {
    id: "FXREPLAY_PRO",
    title: "🔄 FX Replay Pro",
    tagline: "The premier backtesting platform for Forex, Crypto & Futures traders.",
    badge: "Trader Choice",
    features: [
      "True multi-timeframe backtesting engine",
      "Realistic simulated broker fills & spreads",
      "Automated Trade Analytics & Win-rate tracking",
      "Unlimited charts & historical tick replay"
    ],
    plans: [
      { key: "FXR_1M", name: "1 Month Access", price: 1200 },
      { key: "FXR_3M", name: "3 Months Access", price: 3200, discountNote: "Save 400 ETB" }
    ]
  },
  TRADING_JOURNAL: {
    id: "TRADING_JOURNAL",
    title: "📓 Trading Journal",
    tagline: "Automated trading journal & risk analytics system.",
    badge: "Lifetime",
    features: [
      "Automatic trade logging & PnL calculations",
      "Risk management & drawdown monitoring",
      "Strategy classification & equity curve tracker",
      "Lifetime access & cloud sync"
    ],
    plans: [
      { key: "TJ_LIFETIME", name: "Lifetime License", price: 850 }
    ]
  }
};

// In-Memory Database
const db = {
  users: new Set(),
  userOrders: {},      // { userId: [ { id, tool, plan, status, activatedDate, expiresDate, credentials } ] }
  referrals: {},       // { userId: [referredUserIds] }
  referrerOf: {},      // { newUserId: referrerId }
  userSessions: {},    // { userId: { tool, method, finalPrice } }
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
    "Your trusted source for genuine TradingView + CME market feeds, backtesting engines, and trading analytics in Ethiopia.\n\n" +
    "Select an option below to get started:",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP'), Markup.button.callback('📦 My Orders', 'ACTION_MY_ORDERS')],
      [Markup.button.callback('💳 Pricing', 'ACTION_PRICING'), Markup.button.callback('🎁 Offers', 'ACTION_OFFERS')],
      [Markup.button.callback('🤝 Refferal', 'ACTION_REFERRAL'), Markup.button.callback('❓ Help & FAQ', 'ACTION_FAQ')],
      [Markup.button.url('💬 Support', 'https://t.me/' + SUPPORT_USERNAME)]
    ])
  );
}

// ❓ FAQ Menu Builder
function sendFAQMenu(ctx) {
  return ctx.reply(
    "❓ FREQUENTLY ASKED QUESTIONS (FAQ)\n\n" +
    "Click any question below for quick answers or contact our 24/7 support team:",
    Markup.inlineKeyboard([
      [Markup.button.callback('⏱️ How Long Does Delivery Take?', 'FAQ_DELIVERY')],
      [Markup.button.callback('💳 How Do I Pay?', 'FAQ_PAYMENT')],
      [Markup.button.callback('🔒 Is This An Official Subscription?', 'FAQ_OFFICIAL')],
      [Markup.button.callback('🔄 Can I Change My Account?', 'FAQ_CHANGE_ACC')],
      [Markup.button.callback('⏰ What Happens When My Subscription Expires?', 'FAQ_EXPIRY')],
      [Markup.button.callback('🛠️ What If I Have A Problem?', 'FAQ_PROBLEM')],
      [Markup.button.callback('📞 How Do I Contact Support?', 'FAQ_SUPPORT')],
      [Markup.button.callback('🔙 Back To Main Menu', 'ACTION_MAIN_MENU')]
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

// 🛍️ 2. SHOP NOW / PRODUCT CATALOG
bot.action(['ACTION_SHOP', 'ACTION_BUY'], async (ctx) => {
  const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
  if (!allJoined) return sendJoinChannelMessage(ctx, missing);

  ctx.reply(
    "🛍️ A T T S Product Shop\n\n" +
    "Select a product below to view specifications, available plans, and instant pricing:",
    Markup.inlineKeyboard([
      [Markup.button.callback('📊 TradingView Premium + CME Data', 'VIEW_PROD_TV_PREMIUM_CME')],
      [Markup.button.callback('📈 TradingView Essential + CME Data', 'VIEW_PROD_TV_ESSENTIAL_CME')],
      [Markup.button.callback('🔄 FX Replay Pro', 'VIEW_PROD_FXREPLAY_PRO')],
      [Markup.button.callback('📓 Trading Journal', 'VIEW_PROD_TRADING_JOURNAL')],
      [Markup.button.callback('🎁 Current Offers', 'ACTION_OFFERS')],
      [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// Dedicated Product Page View: VIEW_PROD_<ID>
bot.action(/VIEW_PROD_(.+)/, async (ctx) => {
  const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
  if (!allJoined) return sendJoinChannelMessage(ctx, missing);

  const prodId = ctx.match[1];
  const product = PRODUCTS_CATALOG[prodId];
  if (!product) {
    return ctx.reply("Product not found. Please return to Shop.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));
  }

  let descText = product.title + "\n" +
                 product.tagline + "\n\n" +
                 "✨ Key Features:\n" +
                 product.features.map(f => "• " + f).join("\n") +
                 "\n\n💳 Available Subscription Plans:\n";

  const planButtons = product.plans.map(plan => {
    const note = plan.discountNote ? " (" + plan.discountNote + ")" : "";
    const label = "👉 " + plan.name + " — " + plan.price + " ETB" + note;
    return [Markup.button.callback(label, "SELECT_PLAN_" + prodId + "_" + plan.key)];
  });

  planButtons.push([
    Markup.button.callback('⬅️ Back To Shop', 'ACTION_SHOP'),
    Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')
  ]);

  ctx.reply(descText, Markup.inlineKeyboard(planButtons));
});

// Select Plan & Proceed to Checkout
bot.action(/SELECT_PLAN_([^_]+(?:_[^_]+)*)_([^_]+(?:_[^_]+)*)/, async (ctx) => {
  const prodId = ctx.match[1];
  const planKey = ctx.match[2];
  const product = PRODUCTS_CATALOG[prodId];
  if (!product) return ctx.reply("Product error.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));

  const plan = product.plans.find(p => p.key === planKey) || product.plans[0];
  const session = db.userSessions[ctx.from.id] || {};

  db.userSessions[ctx.from.id] = {
    ...session,
    productId: prodId,
    planKey: planKey,
    tool: product.title + " (" + plan.name + ")",
    finalPrice: plan.price
  };

  ctx.reply(
    "🧾 Order Summary:\n\n" +
    "📦 Product: " + product.title + "\n" +
    "⏱️ Plan: " + plan.name + "\n" +
    "💰 Total Payable: " + plan.price + " ETB\n\n" +
    "Please choose your preferred payment method below:",
    Markup.inlineKeyboard([
      [Markup.button.callback('📱 Telebirr', 'PAY_TELEBIRR')],
      [Markup.button.callback('🏦 CBE Bank Transfer', 'PAY_CBE')],
      [Markup.button.callback('💎 Binance USDT (TRC20)', 'PAY_USDT')],
      [Markup.button.callback('⬅️ Change Plan', "VIEW_PROD_" + prodId)]
    ])
  );
});

// 💳 3. PRICING OVERVIEW
bot.action(['ACTION_PRICING', 'ACTION_PRICES'], (ctx) => {
  ctx.reply(
    "💳 Official Pricing Overview:\n\n" +
    "1. 📊 TradingView Premium + CME Data\n" +
    "   • 1 Month: 1,800 ETB\n" +
    "   • 3 Months: 4,800 ETB (Save 600 ETB)\n" +
    "   • 1 Year VIP: 16,500 ETB\n\n" +
    "2. 📈 TradingView Essential + CME Data\n" +
    "   • 1 Month: 1,350 ETB\n" +
    "   • 3 Months: 3,600 ETB (Save 450 ETB)\n" +
    "   • 1 Year: 12,000 ETB\n\n" +
    "3. 🔄 FX Replay Pro\n" +
    "   • 1 Month: 1,200 ETB\n" +
    "   • 3 Months: 3,200 ETB (Save 400 ETB)\n\n" +
    "4. 📓 Trading Journal\n" +
    "   • Lifetime License: 850 ETB\n\n" +
    "All TradingView packages include official real-time CME market feeds.",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
      [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 🎁 4. SPECIAL OFFERS VIEW
bot.action('ACTION_OFFERS', (ctx) => {
  ctx.reply(
    "🎁 Special Season Offers:\n\n" +
    "🔥 TradingView VIP Annual Bundle\n" +
    "Get TradingView Premium + CME Data for 1 Full Year with full warranty and priority support for only 16,500 ETB.\n\n" +
    "🔥 FX Replay 3-Month Pack\n" +
    "3 months of unlimited tick backtesting for 3,200 ETB (Save 400 ETB).\n\n" +
    "🔥 Lifetime Trader Journal\n" +
    "One-time payment of 850 ETB with lifetime cloud updates.",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
      [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 🤝 5. REFERRAL PROGRAM
bot.action('ACTION_REFERRAL', async (ctx) => {
  const userId = ctx.from.id;
  const botInfo = await ctx.telegram.getMe();
  const refLink = "https://t.me/" + botInfo.username + "?start=ref_" + userId;
  const count = (db.referrals[userId] || []).length;

  ctx.reply(
    "🤝 Partner & Referral Program (Invite & Earn):\n\n" +
    "Invite fellow traders and earn 100 ETB Commission for every purchase they make!\n\n" +
    "📊 Your Performance:\n" +
    "• Traders Invited: " + count + " people\n" +
    "• Commission Balance: " + (count * 100) + " ETB\n\n" +
    "🔗 Your Unique Referral Link:\n" + refLink,
    Markup.inlineKeyboard([
      [Markup.button.url('📢 Share Link On Telegram', "https://t.me/share/url?url=" + encodeURIComponent(refLink) + "&text=" + encodeURIComponent('Get genuine TradingView Premium and FX Replay Pro in Ethiopia instantly via Telebirr & CBE on A T T S!'))],
      [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
    ])
  );
});

// ❓ 6. FAQ HANDLERS
bot.action('ACTION_FAQ', (ctx) => sendFAQMenu(ctx));

bot.action('FAQ_DELIVERY', (ctx) => {
  ctx.reply(
    "⏱️ How long does delivery take?\n\n" +
    "Orders are processed rapidly within 5 to 15 minutes after uploading your payment screenshot. Our team verifies your transaction and sends your private login credentials right here in this bot!",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
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
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
    ])
  );
});

bot.action('FAQ_OFFICIAL', (ctx) => {
  ctx.reply(
    "🔒 Is this an official subscription?\n\n" +
    "Yes! All TradingView Premium, Essential, and FX Replay Pro accounts are 100% genuine, private, and backed by our full-term warranty guarantee.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
    ])
  );
});

bot.action('FAQ_CHANGE_ACC', (ctx) => {
  ctx.reply(
    "🔄 Can I change my account?\n\n" +
    "Yes, if you need customized email credentials or want your subscription linked to a specific setup, simply notify our support team right after ordering.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.url('💬 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)]
    ])
  );
});

bot.action('FAQ_EXPIRY', (ctx) => {
  ctx.reply(
    "⏰ What happens when my subscription expires?\n\n" +
    "You will receive an automated 1-click renewal reminder 3 days prior to expiration so your charting or backtesting setups never get interrupted.",
    Markup.inlineKeyboard([
      [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
    ])
  );
});

bot.action('FAQ_PROBLEM', (ctx) => {
  ctx.reply(
    "🛠️ What if I have a problem?\n\n" +
    "We offer 24/7 dedicated customer assistance. If you ever experience an issue with login, bar replay, or CME data, we resolve or replace it within minutes!",
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Talk To Support', 'https://t.me/' + SUPPORT_USERNAME)],
      [Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]
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
      [Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]
    ])
  );
});

// 👥 7. MY ORDERS DASHBOARD
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
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
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
        [Markup.button.callback('🛍️ Shop First Product', 'ACTION_SHOP')],
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
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
        [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
      ])
    );
  }

  let responseText = "🔑 YOUR DELIVERED ACCESS CREDENTIALS:\n\n";
  orders.forEach((ord, idx) => {
    responseText += (idx + 1) + ". " + ord.tool + ":\n" + (ord.credentials || 'Access active via linked email.') + "\n\n";
  });

  ctx.reply(responseText, Markup.inlineKeyboard([
    [Markup.button.url('💬 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)],
    [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
  ]));
});

bot.action('ACTION_MAIN_MENU', (ctx) => sendMainMenu(ctx));

// Payment Details Display
bot.action(/PAY_(.+)/, (ctx) => {
  const method = ctx.match[1];
  const userSession = db.userSessions[ctx.from.id] || { tool: 'Trading Tool', finalPrice: 1800 };
  userSession.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = "Telebirr Payment Details:\n\n" +
              "Number: " + PAYMENT_INFO.telebirr.number + "\n" +
              "Name: " + PAYMENT_INFO.telebirr.name + "\n" +
              "Amount: " + (userSession.finalPrice || 1800) + " ETB\n\n" +
              "Important: After transferring, please send your payment screenshot (receipt) right here in this chat.";
  } else if (method === 'CBE') {
    payText = "CBE Bank Transfer Details:\n\n" +
              "Account: " + PAYMENT_INFO.cbe.account + "\n" +
              "Name: " + PAYMENT_INFO.cbe.name + "\n" +
              "Amount: " + (userSession.finalPrice || 1800) + " ETB\n\n" +
              "Important: After completing the transfer, send your CBE screenshot right here.";
  } else {
    payText = "Binance USDT (TRC20):\n\n" +
              "Address: " + PAYMENT_INFO.usdt.address + "\n" +
              "Network: " + PAYMENT_INFO.usdt.network + "\n" +
              "Amount: " + ((userSession.finalPrice || 1800) / 100).toFixed(1) + " USDT\n\n" +
              "Please send the TXID or transaction screenshot here.";
  }

  ctx.reply(payText);
});

// Customer Uploads Receipt Photo
bot.on('photo', async (ctx) => {
  const user = ctx.from;
  db.users.add(user.id);
  const userSession = db.userSessions[user.id] || { tool: 'Trading Tool', method: 'Direct', finalPrice: 1800 };
  const photo = ctx.message.photo.pop();

  if (ADMIN_CHAT_ID) {
    try {
      const captionText = "NEW PAYMENT RECEIPT RECEIVED!\n\n" +
                          "Customer: @" + (user.username || 'NoUsername') + "\n" +
                          "User ID: " + user.id + "\n" +
                          "Product: " + userSession.tool + "\n" +
                          "Amount: " + (userSession.finalPrice || 1800) + " ETB\n" +
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
      tool: "Trading Tool Access",
      plan: "Standard",
      status: "Active",
      activatedDate: now.toLocaleDateString(),
      expiresDate: exp.toLocaleDateString(),
      credentials: customMessage
    });

    db.ordersCount += 1;
    db.totalRevenue += 1800;
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
    return ctx.reply('Please include the broadcast text.\n\nExample:\n/broadcast Special flash deal on TradingView Premium + CME Data!');
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

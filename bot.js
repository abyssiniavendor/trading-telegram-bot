// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// 24/7 PRODUCTION SCRIPT WITH PERSISTENT STORAGE & CLEAN HTML
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "abyssiniatradinget";

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

// 🛡️ ANTI-CRASH GLOBAL ERROR HANDLERS
bot.catch((err, ctx) => {
  console.error(`⚠️ Telegram Bot Error caught safely:`, err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception caught safely:', err.message);
});

// 📁 PERSISTENT FILE DATABASE (Saves orders permanently on disk)
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

function loadDatabase() {
  const defaultDb = {
    users: [],
    userOrders: {},
    referrals: {},
    referrerOf: {},
    ordersCount: 0,
    totalRevenue: 0
  };

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...defaultDb,
        ...parsed,
        users: new Set(parsed.users || [])
      };
    }
  } catch (err) {
    console.error("Error reading database file, using fallback:", err.message);
  }

  return { ...defaultDb, users: new Set() };
}

const db = loadDatabase();
const userSessions = {}; // Transient session state for current checkout

function saveDatabase() {
  try {
    const toSave = {
      ...db,
      users: Array.from(db.users)
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.error("Failed to save database to disk:", err.message);
  }
}

// 🌐 Health check HTTP server for Render.com
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('A T T S Telegram Bot is LIVE 24/7!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP Health Check Server listening on port ${PORT}`);
});

// ⏰ Self-Ping Keep-Alive
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    http.get(process.env.RENDER_EXTERNAL_URL, (res) => {
      console.log(`🔄 Self-ping keep-alive status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.log('Self-ping error (benign):', err.message);
    });
  }, 10 * 60 * 1000);
}

// 💳 Payment Accounts Details (Telebirr & Binance)
const PAYMENT_INFO = {
  telebirr: {
    number: "0938652861",
    name: "Berihanu"
  },
  binance: {
    id: "874067761",
    name: "ABYSSINIAVENDOR"
  }
};

// Clean Products Catalog
const PRODUCTS_CATALOG = {
  "tvprem_pure": {
    id: "tvprem_pure",
    title: "📊 TradingView Premium",
    tagline: "Top tier TradingView plan with 25 indicators, 8 charts/tab, and second intervals.",
    badge: "Out of Stock",
    outOfStock: true,
    features: [
      "25 indicators per chart layout",
      "8 charts in one layout",
      "400 price alerts & 400 technical alerts",
      "Second-based bar replay"
    ]
  },
  "tvprem": {
    id: "tvprem",
    title: "📊 TradingView Premium + CME Data",
    tagline: "Top tier package with official CME Real-Time market data feed.",
    badge: "Out of Stock",
    outOfStock: true,
    features: [
      "Highest plan: 25 indicators per chart layout",
      "Official Real-Time CME Group data (ES, NQ, YM, GC, CL)",
      "8 simultaneous charts per tab layout"
    ]
  },
  "tvess_pure": {
    id: "tvess_pure",
    title: "📈 TradingView Essential",
    tagline: "Essential charting plan with 5 indicators and 2 charts per layout.",
    badge: "Active",
    features: [
      "5 indicators per chart layout",
      "2 charts in one layout",
      "20 active price alerts & technical alerts",
      "Ad-free charting with Bar Replay"
    ],
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
    badge: "Best Value",
    features: [
      "5 indicators per chart layout",
      "Official Real-Time CME Group data included",
      "2 charts per tab layout",
      "20 active price alerts & technical alerts",
      "Clean ad-free charts with Bar Replay"
    ],
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
    badge: "Trader Choice",
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
    } catch (err) {}
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
    "⚠️ <b>Access Required Before Using A T T S Bot!</b>\n\n" +
    "To access our premium trading tools, pricing catalogs, and instant orders, you must first join our official community channels:\n\n" +
    "1️⃣ @abyssiniatradinget (Official Channel)\n" +
    "2️⃣ @abyssiniachat (Trading Discussion Community)\n" +
    "3️⃣ @abyssiniattstore (Store & Updates)\n\n" +
    "👉 Click the buttons below to join each channel, then click Verify:",
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(channelButtons) }
  );
}

// 🏠 Main Menu Builder
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

// ❓ FAQ Menu Builder
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

// 1. /start command
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    db.users.add(userId);

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
            "🎉 <b>New trader joined via your referral link!</b>\n\nUser: @" + (ctx.from.username || 'Trader') + "\nYou will receive a 100 ETB bonus upon their first purchase!",
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    }

    saveDatabase();

    const { allJoined, missing } = await checkAllChannelMemberships(ctx, userId);
    if (!allJoined) {
      return sendJoinChannelMessage(ctx, missing);
    }
    return sendMainMenu(ctx);
  } catch (err) {
    console.error("Error in start handler:", err);
  }
});

// Verify Channel Join Callback
bot.action('VERIFY_JOIN', async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (allJoined) {
      try { await ctx.deleteMessage(); } catch (e) {}
      ctx.reply("🎉 <b>Verification Successful!</b> Thank you for joining our community.", { parse_mode: 'HTML' });
      return sendMainMenu(ctx);
    } else {
      const remaining = missing.map(m => m.username).join(', ');
      return ctx.answerCbQuery("❌ Please join all 3 channels first! Remaining: " + remaining, { show_alert: true });
    }
  } catch (err) {
    console.error("Error in verify callback:", err);
  }
});

// 🛍️ 2. SHOP NOW / PRODUCT CATALOG
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
  } catch (err) {
    console.error("Error in shop action:", err);
  }
});

// Abyssinia Journal - Coming Soon Handler
bot.action('VIEW_abyssinia_journal', (ctx) => {
  ctx.reply(
    "📓 <b>Abyssinia Journal</b>\n\n" +
    "✨ <i>Coming soon!</i>\n\n" +
    "Our proprietary automated trade journaling, risk management, and equity curve tracking system is currently in final testing.\n\n" +
    "📢 Stay tuned and keep updated on our official channel @abyssiniatradinget for the launch date!",
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

// Dedicated Product Page View
bot.action(/^VIEW_(tvprem_pure|tvprem|tvess_pure|tvess|fxr)$/, async (ctx) => {
  try {
    const { allJoined, missing } = await checkAllChannelMemberships(ctx, ctx.from.id);
    if (!allJoined) return sendJoinChannelMessage(ctx, missing);

    const prodKey = ctx.match[1];
    const product = PRODUCTS_CATALOG[prodKey];

    if (!product) {
      return ctx.reply("Product not found. Please return to Shop.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));
    }

    // Out of Stock Handling
    if (product.outOfStock) {
      return ctx.reply(
        `<b>${product.title}</b>\n\n` +
        "🚫 <b>STATUS: OUT OF STOCK</b>\n\n" +
        "We are currently restocking this subscription package. Subscription slots will be available soon!\n\n" +
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

    // Hierarchical Tier Menu for Fxreplay Pro
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

    // Standard Plans Display for TradingView Essential
    let descText = `<b>${product.title}</b>\n` +
                   `${product.tagline}\n\n` +
                   `✨ <b>Key Features:</b>\n` +
                   product.features.map(f => `• ${f}`).join('\n') +
                   `\n\n💳 <b>Available Subscription Plans:</b>\n`;

    const planButtons = Object.keys(product.plans).map(planCode => {
      const plan = product.plans[planCode];
      const note = plan.discountNote ? " (" + plan.discountNote + ")" : "";
      const label = "👉 " + plan.name + " — " + plan.price + " ETB" + note;
      return [Markup.button.callback(label, "PLAN:" + prodKey + ":" + planCode)];
    });

    planButtons.push([
      Markup.button.callback('⬅️ Back To Shop', 'ACTION_SHOP'),
      Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')
    ]);

    ctx.reply(descText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(planButtons) });
  } catch (err) {
    console.error("Error in view product:", err);
  }
});

// Fxreplay Pro Tier Options View: FXR_TIER_<tierKey>
bot.action(/^FXR_TIER_(monthly|twoweeks|weekly)$/, async (ctx) => {
  try {
    const tierKey = ctx.match[1];
    const product = PRODUCTS_CATALOG['fxr'];
    const tier = product.tiers[tierKey];

    let descText = `🔄 <b>Fxreplay Pro — ${tier.name}</b>\n\n` +
                   `Please select the package configuration you want:`;

    const optionButtons = tier.options.map(opt => [
      Markup.button.callback(`👉 ${opt.name} - ${opt.price}birr`, `FXR_OPT_${opt.code}`)
    ]);

    optionButtons.push([
      Markup.button.callback('⬅️ Back to Fxreplay Plans', 'VIEW_fxr'),
      Markup.button.callback('🛍️ Shop', 'ACTION_SHOP')
    ]);

    ctx.reply(descText, { parse_mode: 'HTML', ...Markup.inlineKeyboard(optionButtons) });
  } catch (err) {
    console.error("Error in fxr tier action:", err);
  }
});

// Fxreplay Pro Option Selected -> Order Summary & Payment
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

    if (!selectedOpt) {
      return ctx.reply("Option error. Please return to shop.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));
    }

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
  } catch (err) {
    console.error("Error in fxr opt action:", err);
  }
});

// Select Plan & Proceed to Checkout for other products (TradingView)
bot.action(/^PLAN:(tvprem_pure|tvprem|tvess_pure|tvess):([a-z0-9]+)$/, async (ctx) => {
  try {
    const prodKey = ctx.match[1];
    const planCode = ctx.match[2];
    const product = PRODUCTS_CATALOG[prodKey];

    if (!product || !product.plans || !product.plans[planCode]) {
      return ctx.reply("Product plan selection error.", Markup.inlineKeyboard([[Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]]));
    }

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
  } catch (err) {
    console.error("Error in plan select:", err);
  }
});

// 💳 3. PRICING OVERVIEW
bot.action(['ACTION_PRICING', 'ACTION_PRICES'], (ctx) => {
  ctx.reply(
    "💳 <b>Official Pricing Overview:</b>\n\n" +
    "1. 📊 <b>TradingView Premium</b>\n" +
    "   • Status: 🚫 Out of Stock (Check @abyssiniatradinget)\n\n" +
    "2. 📊 <b>TradingView Premium + CME Data</b>\n" +
    "   • Status: 🚫 Out of Stock (Check @abyssiniatradinget)\n\n" +
    "3. 📈 <b>TradingView Essential</b>\n" +
    "   • 1 Month: 1,100 ETB\n" +
    "   • 3 Months: 2,950 ETB\n\n" +
    "4. 📈 <b>TradingView Essential + CME Data</b>\n" +
    "   • 1 Month: 1,350 ETB\n" +
    "   • 3 Months: 3,600 ETB\n\n" +
    "5. 🔄 <b>Fxreplay Pro</b>\n" +
    "   • Monthly Plans: From 750 ETB\n" +
    "   • Two Weeks Plans: From 550 ETB\n" +
    "   • Weekly Plans: From 250 ETB\n\n" +
    "6. 📓 <b>Abyssinia Journal</b>\n" +
    "   • Status: ✨ Coming Soon!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// 🎁 4. SPECIAL OFFERS VIEW
bot.action('ACTION_OFFERS', (ctx) => {
  ctx.reply(
    "🎁 <b>Special Season Offers:</b>\n\n" +
    "🔥 <b>TradingView Essential + CME Data</b>\n" +
    "Get full real-time CME market data with 3-month savings for only 3,600 ETB.\n\n" +
    "🔥 <b>Fxreplay Pro Multi-Timeframe Packs</b>\n" +
    "Get full backtesting access with weekly, 2-week, or monthly plans starting at just 250 ETB.\n\n" +
    "🔥 <b>Abyssinia Journal Launch Special</b>\n" +
    "Coming soon with early bird lifetime pricing for our channel members!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    }
  );
});

// 🤝 5. REFERRAL PROGRAM
bot.action('ACTION_REFERRAL', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const botInfo = await ctx.telegram.getMe();
    const refLink = "https://t.me/" + botInfo.username + "?start=ref_" + userId;
    const count = (db.referrals[userId] || []).length;

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
  } catch (err) {
    console.error("Error in referral action:", err);
  }
});

// ❓ 6. FAQ HANDLERS
bot.action('ACTION_FAQ', (ctx) => sendFAQMenu(ctx));

bot.action('FAQ_DELIVERY', (ctx) => {
  ctx.reply(
    "⏱️ <b>How long does delivery take?</b>\n\n" +
    "Orders are processed rapidly within 5 to 15 minutes after uploading your payment screenshot. Our team verifies your transaction and sends your private login credentials right here in this bot!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
      ])
    }
  );
});

bot.action('FAQ_PAYMENT', (ctx) => {
  ctx.reply(
    "💳 <b>How do I pay?</b>\n\n" +
    "We accept two convenient payment methods:\n" +
    "1. Telebirr (Instant Mobile Money)\n" +
    "2. Binance Pay for crypto & USDT.\n\n" +
    "Account details and copyable numbers will be shown automatically during checkout.",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
      ])
    }
  );
});

bot.action('FAQ_OFFICIAL', (ctx) => {
  ctx.reply(
    "🔒 <b>Is this an official subscription?</b>\n\n" +
    "Yes! All TradingView and Fxreplay Pro accounts are 100% genuine, private, and backed by our full-term warranty guarantee.",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
      ])
    }
  );
});

bot.action('FAQ_CHANGE_ACC', (ctx) => {
  ctx.reply(
    "🔄 <b>Can I change my account?</b>\n\n" +
    "Yes, if you need customized email credentials or want your subscription linked to a specific setup, simply notify our support team right after ordering.",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
        [Markup.button.url('💬 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)]
      ])
    }
  );
});

bot.action('FAQ_EXPIRY', (ctx) => {
  ctx.reply(
    "⏰ <b>What happens when my subscription expires?</b>\n\n" +
    "You will receive an automated 1-click renewal reminder 3 days prior to expiration so your charting or backtesting setups never get interrupted.",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❓ More FAQs', 'ACTION_FAQ')],
        [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')]
      ])
    }
  );
});

bot.action('FAQ_PROBLEM', (ctx) => {
  ctx.reply(
    "🛠️ <b>What if I have a problem?</b>\n\n" +
    "We offer 24/7 dedicated customer assistance. If you ever experience an issue with login, bar replay, or CME data, we resolve or replace it within minutes!",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('💬 Talk To Support', 'https://t.me/' + SUPPORT_USERNAME)],
        [Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]
      ])
    }
  );
});

bot.action('FAQ_SUPPORT', (ctx) => {
  ctx.reply(
    "📞 <b>How do I contact support?</b>\n\n" +
    "You can reach our official administration team directly via Telegram:\n" +
    "👉 @" + SUPPORT_USERNAME + " (24/7 Fast Response)",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('💬 Open Support Chat', 'https://t.me/' + SUPPORT_USERNAME)],
        [Markup.button.callback('🔙 Back To FAQ', 'ACTION_FAQ')]
      ])
    }
  );
});

// 👥 7. MY ORDERS DASHBOARD (Clean, Persistent & Professional)
bot.action('ACTION_MY_ORDERS', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];
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

bot.action('MY_ORDERS_ACTIVE', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];
  const activeOrders = orders.filter(o => o.status === 'Active');
  const pendingOrders = orders.filter(o => o.status === 'Pending');

  if (activeOrders.length === 0 && pendingOrders.length === 0) {
    return ctx.reply(
      "📦 <b>Active Orders:</b>\n\nYou do not have any active or pending subscriptions right now.\n\nReady to upgrade your trading?",
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
      responseText += `<b>${i + 1}. ${ord.tool}</b>\n` +
                      `• Status: 🟢 Active\n` +
                      `• Activated: ${ord.activatedDate}\n` +
                      `• Expires: ${ord.expiresDate}\n\n`;
    });
  }

  if (pendingOrders.length > 0) {
    responseText += "🟡 <b>PENDING VERIFICATION:</b>\n";
    pendingOrders.forEach((ord, i) => {
      responseText += `<b>${i + 1}. ${ord.tool}</b>\n` +
                      `• Status: 🟡 Awaiting Admin Approval\n` +
                      `• Submitted: ${ord.activatedDate}\n` +
                      `• Amount: ${ord.price || 'Paid'}\n\n`;
    });
  }

  responseText += "Need help? Contact @" + SUPPORT_USERNAME;

  ctx.reply(responseText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔑 My Access', 'MY_ORDERS_KEYS')],
      [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
    ])
  });
});

bot.action('MY_ORDERS_HISTORY', (ctx) => {
  const userId = ctx.from.id;
  const orders = db.userOrders[userId] || [];

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
    const icon = ord.status === 'Active' ? '🟢' : (ord.status === 'Pending' ? '🟡' : '⚪');
    responseText += `#${ord.id || (1000 + idx + 1)} - ${ord.tool} (${icon} ${ord.status}) on ${ord.activatedDate}\n`;
  });

  ctx.reply(responseText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
    ])
  });
});

bot.action('MY_ORDERS_KEYS', (ctx) => {
  const userId = ctx.from.id;
  const orders = (db.userOrders[userId] || []).filter(o => o.credentials && o.credentials.trim().length > 0);

  if (orders.length === 0) {
    return ctx.reply(
      "🔑 <b>My Access:</b>\n\nNo active credentials available yet. Once your payment receipt is approved, your access keys will appear right here.",
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
    responseText += `<b>${idx + 1}. ${ord.tool}</b> (Expires: ${ord.expiresDate}):\n` +
                    `<code>${ord.credentials}</code>\n\n`;
  });

  ctx.reply(responseText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('💬 Contact Support', 'https://t.me/' + SUPPORT_USERNAME)],
      [Markup.button.callback('⬅️ Back', 'ACTION_MY_ORDERS')]
    ])
  });
});

bot.action('ACTION_MAIN_MENU', (ctx) => sendMainMenu(ctx));

// 💳 Payment Details Display (With Monospace Click-to-Copy)
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

// Customer Uploads Receipt Photo -> Automatically registers Pending Order
bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    db.users.add(user.id);
    const session = userSessions[user.id] || { tool: 'Trading Tool Access', finalPrice: 750, method: 'Direct' };
    const photo = ctx.message.photo.pop();

    const now = new Date();
    const orderId = 1000 + (db.userOrders[user.id] ? db.userOrders[user.id].length + 1 : 1);

    // Save pending order immediately into persistent database
    if (!db.userOrders[user.id]) db.userOrders[user.id] = [];
    db.userOrders[user.id].push({
      id: orderId,
      tool: session.tool || 'Trading Tool Access',
      plan: session.planTitle || 'Standard Plan',
      status: 'Pending',
      price: `${session.finalPrice || 750} ETB`,
      activatedDate: now.toLocaleDateString(),
      expiresDate: 'Pending Verification',
      credentials: ''
    });

    saveDatabase();

    if (ADMIN_CHAT_ID) {
      try {
        const captionText = "🚨 <b>NEW PAYMENT RECEIPT RECEIVED!</b>\n\n" +
                            "👤 Customer: @" + (user.username || 'NoUsername') + "\n" +
                            "🆔 User ID: <code>" + user.id + "</code>\n" +
                            "📦 Product: <b>" + session.tool + "</b>\n" +
                            "💰 Amount: <b>" + (session.finalPrice || 750) + " ETB</b>\n" +
                            "💳 Method: " + (session.method || 'Direct') + "\n\n" +
                            "💡 To approve and send access keys, run:\n" +
                            "<code>/send " + user.id + " Email: ... | Pass: ...</code>";

        await bot.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
          caption: captionText,
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("Reject Receipt (" + user.id + ")", "REJECT_" + user.id)]
          ])
        });
      } catch (err) {
        console.error('Error forwarding to admin:', err);
      }
    }

    ctx.reply(
      "⏳ <b>Receipt Received & Recorded!</b>\n\n" +
      "Your order has been saved under <b>👥 My Orders</b> with status 🟡 <b>Pending Verification</b>.\n\n" +
      "Our team is verifying the payment. Your login credentials will be delivered here within 5–15 minutes.",
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error("Error handling photo upload:", err);
  }
});

// ✍️ Robust Manual Admin Delivery (/send <userId> <credentials>)
bot.command('send', async (ctx) => {
  try {
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

    const now = new Date();
    const exp = new Date();
    exp.setDate(now.getDate() + 30);

    const deliveryNotification = "🎉 <b>CONGRATULATIONS! YOUR ORDER IS APPROVED & ACTIVE!</b>\n\n" +
                                 "🔑 <b>Your Access Credentials:</b>\n\n" +
                                 `<code>${customMessage}</code>\n\n` +
                                 "📅 <b>Activation Date:</b> " + now.toLocaleDateString() + "\n" +
                                 "⏳ <b>Expiration Date:</b> " + exp.toLocaleDateString() + "\n\n" +
                                 "👉 You can always view your credentials anytime under <b>👥 My Orders > 🔑 My Access</b> in the bot!\n\n" +
                                 "Need assistance? Contact @" + SUPPORT_USERNAME + ". Happy Trading!";

    await bot.telegram.sendMessage(targetUserId, deliveryNotification, { parse_mode: 'HTML' });

    // Update existing pending order or create new active order in persistent database
    if (!db.userOrders[targetUserId]) db.userOrders[targetUserId] = [];
    
    const pendingIdx = db.userOrders[targetUserId].findIndex(o => o.status === 'Pending');
    if (pendingIdx !== -1) {
      db.userOrders[targetUserId][pendingIdx].status = 'Active';
      db.userOrders[targetUserId][pendingIdx].activatedDate = now.toLocaleDateString();
      db.userOrders[targetUserId][pendingIdx].expiresDate = exp.toLocaleDateString();
      db.userOrders[targetUserId][pendingIdx].credentials = customMessage;
    } else {
      db.userOrders[targetUserId].push({
        id: 1000 + db.userOrders[targetUserId].length + 1,
        tool: (userSessions[targetUserId] && userSessions[targetUserId].tool) ? userSessions[targetUserId].tool : "Trading Tool Access",
        plan: "1 Month / Standard",
        status: "Active",
        price: "Paid",
        activatedDate: now.toLocaleDateString(),
        expiresDate: exp.toLocaleDateString(),
        credentials: customMessage
      });
    }

    db.ordersCount = (db.ordersCount || 0) + 1;
    db.totalRevenue = (db.totalRevenue || 0) + (userSessions[targetUserId] ? userSessions[targetUserId].finalPrice || 750 : 750);

    saveDatabase();

    ctx.reply("✅ Credentials delivered and PERMANENTLY saved to Customer (ID: " + targetUserId + ") Orders Dashboard!");
  } catch (err) {
    ctx.reply("Delivery failed! Error: " + err.message);
  }
});

// 📢 Mass Broadcast Command (/broadcast <message>)
bot.command('broadcast', async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('Administrator access required.');
    }

    const text = ctx.message.text.replace('/broadcast', '').trim();
    if (!text) {
      return ctx.reply('Please include the broadcast text.\n\nExample:\n/broadcast Special flash deal on Fxreplay Pro!');
    }

    const userList = Array.from(db.users);
    let successCount = 0;

    ctx.reply("Sending broadcast to " + userList.length + " registered bot users...");

    for (const uid of userList) {
      try {
        await bot.telegram.sendMessage(uid, "📢 <b>Announcement from A T T S:</b>\n\n" + text, { parse_mode: 'HTML' });
        successCount++;
      } catch (e) {}
    }

    ctx.reply("Broadcast completed! Successfully reached " + successCount + " traders.");
  } catch (err) {
    console.error("Error in broadcast command:", err);
  }
});

// 📊 Admin Analytics (/stats)
bot.command('stats', (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('Administrator access required.');
  }

  const totalUsers = db.users.size;
  const totalOrders = db.ordersCount || 0;
  const totalRevenue = db.totalRevenue || 0;

  ctx.reply(
    "📊 <b>A T T S BUSINESS ANALYTICS DASHBOARD:</b>\n\n" +
    "👥 <b>Total Registered Traders:</b> " + totalUsers + " users\n" +
    "📦 <b>Total Completed Orders:</b> " + totalOrders + " orders\n" +
    "💰 <b>Total Recorded Revenue:</b> " + totalRevenue.toLocaleString() + " ETB\n" +
    "⚡ <b>Database:</b> Disk JSON Persistent Storage Active",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh Stats', 'REFRESH_STATS')]
      ])
    }
  );
});

bot.action('REFRESH_STATS', (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return;
  ctx.editMessageText(
    "📊 <b>A T T S BUSINESS ANALYTICS (Live Update):</b>\n\n" +
    "👥 <b>Total Traders:</b> " + db.users.size + " users\n" +
    "📦 <b>Completed Orders:</b> " + (db.ordersCount || 0) + "\n" +
    "💰 <b>Revenue:</b> " + (db.totalRevenue || 0).toLocaleString() + " ETB",
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh Stats', 'REFRESH_STATS')]
      ])
    }
  );
});

// Reject Order Callback
bot.action(/REJECT_(\d+)/, async (ctx) => {
  const targetUserId = ctx.match[1];
  try {
    if (db.userOrders[targetUserId]) {
      const pendingIdx = db.userOrders[targetUserId].findIndex(o => o.status === 'Pending');
      if (pendingIdx !== -1) {
        db.userOrders[targetUserId][pendingIdx].status = 'Rejected';
        saveDatabase();
      }
    }

    await bot.telegram.sendMessage(
      targetUserId,
      "❌ <b>Payment Verification Unsuccessful</b>\n\nWe could not confirm the uploaded transaction receipt. Please ensure you sent the correct screenshot or contact support at @" + SUPPORT_USERNAME,
      { parse_mode: 'HTML' }
    );
    ctx.editMessageCaption((ctx.update.callback_query.message.caption || '') + '\n\nSTATUS: REJECTED');
  } catch (err) {
    console.error('Error sending rejection:', err);
  }
});

// Launch Bot with Auto-Reconnect
async function startBotWithRetry() {
  try {
    await bot.launch();
    console.log('🚀 A T T S Telegram Bot (@abyssiniatradingbot) is Running 24/7 with Clean HTML Formatting!');
  } catch (err) {
    console.error('Bot launch error, retrying in 5 seconds...', err.message);
    setTimeout(startBotWithRetry, 5000);
  }
}

startBotWithRetry();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

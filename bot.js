// ============================================================
// 🤖 A T T S - ABYSSINIA TRADING TOOLS STORE (@abyssiniatradingbot)
// 24/7 CRASH-PROOF & AUTO-RECONNECT PRODUCTION SCRIPT
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');

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
  console.error(`⚠️ Telegram Bot Error caught safely for update ${ctx.updateType}:`, err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception caught safely:', err.message);
});

// 🌐 Health check HTTP server for Render.com
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('✅ A T T S Telegram Bot (@abyssiniatradingbot) is LIVE and HEALTHY 24/7!');
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

// In-Memory Database
const db = {
  users: new Set(),
  userOrders: {},
  referrals: {},
  referrerOf: {},
  userSessions: {},
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
      ctx.reply("🎉 Verification Successful! Thank you for joining our community.");
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
      "🛍️ **A T T S Product Shop**\n\n" +
      "Select a product below to view specifications, available plans, and instant pricing:",
      Markup.inlineKeyboard([
        [Markup.button.callback('📊 TradingView Premium', 'VIEW_tvprem_pure')],
        [Markup.button.callback('📊 TradingView Premium + CME Data', 'VIEW_tvprem')],
        [Markup.button.callback('📈 TradingView Essential', 'VIEW_tvess_pure')],
        [Markup.button.callback('📈 TradingView Essential + CME Data', 'VIEW_tvess')],
        [Markup.button.callback('🔄 Fxreplay Pro', 'VIEW_fxr')],
        [Markup.button.callback('📓 Abyssinia Journal', 'VIEW_abyssinia_journal')],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    );
  } catch (err) {
    console.error("Error in shop action:", err);
  }
});

// Abyssinia Journal - Coming Soon Handler
bot.action('VIEW_abyssinia_journal', (ctx) => {
  ctx.reply(
    "📓 **Abyssinia Journal**\n\n" +
    "✨ *Coming soon!*\n\n" +
    "Our proprietary automated trade journaling, risk management, and equity curve tracking system is currently in final testing.\n\n" +
    "📢 Stay tuned and keep updated on our official channel @abyssiniatradinget for the launch date!",
    Markup.inlineKeyboard([
      [Markup.button.url('📢 Follow Updates in Channel', 'https://t.me/abyssiniatradinget')],
      [Markup.button.callback('🛍️ Back To Shop', 'ACTION_SHOP')],
      [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
    ])
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
        `${product.title}\n\n` +
        "🚫 **STATUS: OUT OF STOCK**\n\n" +
        "We are currently restocking this subscription package. Subscription slots will be available soon!\n\n" +
        "📢 **Keep updated on our official channel @abyssiniatradinget for instant restock announcements!**",
        Markup.inlineKeyboard([
          [Markup.button.url('📢 Go To Official Channel', 'https://t.me/abyssiniatradinget')],
          [Markup.button.callback('🛍️ Back To Shop', 'ACTION_SHOP')],
          [Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
        ])
      );
    }

    // Special Hierarchical Tier Menu for Fxreplay Pro
    if (prodKey === 'fxr') {
      let descText = `${product.title}\n` +
                     `${product.tagline}\n\n` +
                     `✨ **Key Features:**\n` +
                     product.features.map(f => `• ${f}`).join('\n') +
                     `\n\n👇 **Choose your subscription plan:**`;

      const tierButtons = [
        [Markup.button.callback('📅 Monthly subscription plan', 'FXR_TIER_monthly')],
        [Markup.button.callback('⏳ Two weeks subscription plan', 'FXR_TIER_twoweeks')],
        [Markup.button.callback('⚡ Weekly subscription plan', 'FXR_TIER_weekly')],
        [Markup.button.callback('⬅️ Back To Shop', 'ACTION_SHOP'), Markup.button.callback('🏠 Main Menu', 'ACTION_MAIN_MENU')]
      ];
      return ctx.reply(descText, Markup.inlineKeyboard(tierButtons));
    }

    // Standard Plans Display for TradingView Essential
    let descText = product.title + "\n" +
                   product.tagline + "\n\n" +
                   "✨ Key Features:\n" +
                   product.features.map(f => "• " + f).join("\n") +
                   "\n\n💳 Available Subscription Plans:\n";

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

    ctx.reply(descText, Markup.inlineKeyboard(planButtons));
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

    let descText = `🔄 **Fxreplay Pro — ${tier.name}**\n\n` +
                   `Please select the package configuration you want:`;

    const optionButtons = tier.options.map(opt => [
      Markup.button.callback(`👉 ${opt.name} - ${opt.price}birr`, `FXR_OPT_${opt.code}`)
    ]);

    optionButtons.push([
      Markup.button.callback('⬅️ Back to Fxreplay Plans', 'VIEW_fxr'),
      Markup.button.callback('🛍️ Shop', 'ACTION_SHOP')
    ]);

    ctx.reply(descText, Markup.inlineKeyboard(optionButtons));
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

    const session = db.userSessions[ctx.from.id] || {};
    db.userSessions[ctx.from.id] = {
      ...session,
      productId: 'fxr',
      planKey: optCode,
      tool: `Fxreplay Pro - ${selectedOpt.name}`,
      finalPrice: selectedOpt.price
    };

    ctx.reply(
      "🧾 **Order Summary:**\n\n" +
      "📦 **Product:** Fxreplay Pro\n" +
      `📁 **Plan:** ${selectedTierName}\n` +
      `✨ **Package:** ${selectedOpt.name}\n` +
      `💰 **Total Payable:** ${selectedOpt.price} ETB\n\n` +
      "Please choose your preferred payment method below:",
      Markup.inlineKeyboard([
        [Markup.button.callback('📱 Telebirr', 'PAY_TELEBIRR')],
        [Markup.button.callback('💎 Binance', 'PAY_BINANCE')],
        [Markup.button.callback('⬅️ Change Plan', 'VIEW_fxr')]
      ])
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
    const session = db.userSessions[ctx.from.id] || {};

    db.userSessions[ctx.from.id] = {
      ...session,
      productId: prodKey,
      planKey: planCode,
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
        [Markup.button.callback('💎 Binance', 'PAY_BINANCE')],
        [Markup.button.callback('⬅️ Change Plan', "VIEW_" + prodKey)]
      ])
    );
  } catch (err) {
    console.error("Error in plan select:", err);
  }
});

// 💳 3. PRICING OVERVIEW
bot.action(['ACTION_PRICING', 'ACTION_PRICES'], (ctx) => {
  ctx.reply(
    "💳 Official Pricing Overview:\n\n" +
    "1. 📊 TradingView Premium\n" +
    "   • Status: 🚫 Out of Stock (Check @abyssiniatradinget)\n\n" +
    "2. 📊 TradingView Premium + CME Data\n" +
    "   • Status: 🚫 Out of Stock (Check @abyssiniatradinget)\n\n" +
    "3. 📈 TradingView Essential\n" +
    "   • 1 Month: 1,100 ETB\n" +
    "   • 3 Months: 2,950 ETB\n\n" +
    "4. 📈 TradingView Essential + CME Data\n" +
    "   • 1 Month: 1,350 ETB\n" +
    "   • 3 Months: 3,600 ETB\n\n" +
    "5. 🔄 Fxreplay Pro\n" +
    "   • Monthly Plans: From 750 ETB\n" +
    "   • Two Weeks Plans: From 550 ETB\n" +
    "   • Weekly Plans: From 250 ETB\n\n" +
    "6. 📓 Abyssinia Journal\n" +
    "   • Status: ✨ Coming Soon!",
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
    "🔥 TradingView Essential + CME Data\n" +
    "Get full real-time CME market data with 3-month savings for only 3,600 ETB.\n\n" +
    "🔥 Fxreplay Pro Multi-Timeframe Packs\n" +
    "Get full backtesting access with weekly, 2-week, or monthly plans starting at just 250 ETB.\n\n" +
    "🔥 Abyssinia Journal Launch Special\n" +
    "Coming soon with early bird lifetime pricing for our channel members!",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛍️ Shop Now', 'ACTION_SHOP')],
      [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
    ])
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
      "🤝 Partner & Referral Program (Invite & Earn):\n\n" +
      "Invite fellow traders and earn 100 ETB Commission for every purchase they make!\n\n" +
      "📊 Your Performance:\n" +
      "• Traders Invited: " + count + " people\n" +
      "• Commission Balance: " + (count * 100) + " ETB\n\n" +
      "🔗 Your Unique Referral Link:\n" + refLink,
      Markup.inlineKeyboard([
        [Markup.button.url('📢 Share Link On Telegram', "https://t.me/share/url?url=" + encodeURIComponent(refLink) + "&text=" + encodeURIComponent('Get genuine TradingView and Fxreplay Pro in Ethiopia instantly via Telebirr & Binance on A T T S!'))],
        [Markup.button.callback('⬅️ Back To Main Menu', 'ACTION_MAIN_MENU')]
      ])
    );
  } catch (err) {
    console.error("Error in referral action:", err);
  }
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
    "We accept two convenient payment methods:\n" +
    "1. Telebirr (Instant Mobile Money)\n" +
    "2. Binance Pay for crypto & USDT.\n\n" +
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
    "Yes! All TradingView and Fxreplay Pro accounts are 100% genuine, private, and backed by our full-term warranty guarantee.",
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

// 💳 Payment Details Display (With Monospace Click-to-Copy)
bot.action(/PAY_(.+)/, (ctx) => {
  const method = ctx.match[1];
  const userSession = db.userSessions[ctx.from.id] || { tool: 'Trading Tool', finalPrice: 750 };
  userSession.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = "📱 *Telebirr Payment Details*\n\n" +
              "• Phone Number: `" + PAYMENT_INFO.telebirr.number + "` (Tap to copy)\n" +
              "• Account Name: `" + PAYMENT_INFO.telebirr.name + "`\n" +
              "• Amount: `" + (userSession.finalPrice || 750) + " ETB`\n\n" +
              "⚠️ *Important:* After completing the payment, please send your transaction screenshot (receipt) right here in this chat.";
  } else {
    payText = "💎 *Binance Payment Details*\n\n" +
              "• Binance Pay ID: `" + PAYMENT_INFO.binance.id + "` (Tap to copy)\n" +
              "• Payee Name: `" + PAYMENT_INFO.binance.name + "`\n" +
              "• Amount: `" + ((userSession.finalPrice || 750) / 100).toFixed(1) + " USDT`\n\n" +
              "⚠️ *Important:* After sending via Binance Pay, please upload your transfer screenshot or TXID here.";
  }

  ctx.reply(payText, { parse_mode: 'Markdown' });
});

// Customer Uploads Receipt Photo
bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    db.users.add(user.id);
    const userSession = db.userSessions[user.id] || { tool: 'Trading Tool', method: 'Direct', finalPrice: 750 };
    const photo = ctx.message.photo.pop();

    if (ADMIN_CHAT_ID) {
      try {
        const captionText = "NEW PAYMENT RECEIPT RECEIVED!\n\n" +
                            "Customer: @" + (user.username || 'NoUsername') + "\n" +
                            "User ID: " + user.id + "\n" +
                            "Product: " + userSession.tool + "\n" +
                            "Amount: " + (userSession.finalPrice || 750) + " ETB\n" +
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

    const deliveryNotification = "CONGRATULATIONS! YOUR ORDER IS APPROVED & ACTIVE!\n\n" +
                                 "Your Access Credentials:\n\n" +
                                 customMessage + "\n\n" +
                                 "Activation Date: " + now.toLocaleDateString() + "\n" +
                                 "Expiration Date: " + exp.toLocaleDateString() + "\n\n" +
                                 "You can always view this anytime under the 'My Orders' menu in the bot!\n" +
                                 "Need assistance? Contact @" + SUPPORT_USERNAME + ". Happy Trading!";

    await bot.telegram.sendMessage(targetUserId, deliveryNotification);

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
    db.totalRevenue += 750;
    ctx.reply("Credentials delivered and recorded in Customer (ID: " + targetUserId + ") Orders Dashboard!");
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
        await bot.telegram.sendMessage(uid, "Announcement from A T T S:\n\n" + text);
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

// Launch Bot with Auto-Reconnect
async function startBotWithRetry() {
  try {
    await bot.launch();
    console.log('🚀 A T T S Telegram Bot (@abyssiniatradingbot) is Running 24/7!');
  } catch (err) {
    console.error('Bot launch error, retrying in 5 seconds...', err.message);
    setTimeout(startBotWithRetry, 5000);
  }
}

startBotWithRetry();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

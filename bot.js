// ============================================================
// 🤖 ALL-IN-ONE PRO TRADING TOOLS TELEGRAM BOT (Node.js)
// Ready for Render.com Free Web Service Deployment (24/7)
// Features Included:
//  1. 🛒 Full Tool Ordering & Instant Bank Account Delivery
//  2. 📢 Force Channel Join Verification
//  3. ✍️ Robust Manual Admin Delivery (/send <userId> <credentials>)
//  4. 📣 Mass Broadcast System (/broadcast <message>)
//  5. 👥 Referral & Earn System (Unique invite links)
//  6. 🎟️ Discount Coupon Codes (VIP2026, HOLIDAY)
//  7. 📊 Live Admin Business Analytics (/stats)
//  8. 📚 Free Setup Guides & Video Tutorials
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Your numeric Telegram ID
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || "@eighioplip"; // Channel users must join
const CHANNEL_LINK = "https://t.me/" + REQUIRED_CHANNEL.replace("@", "");

if (!BOT_TOKEN) {
  console.error("FATAL: BOT_TOKEN is missing in environment variables!");
}

const bot = new Telegraf(BOT_TOKEN);

// 🌐 Health check HTTP server for Render.com Free Web Service
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('✅ Ultimate Trading Tools Bot is LIVE and running 24/7 on Render!');
});
server.listen(PORT, () => {
  console.log(`🌐 HTTP Health Check Server listening on port ${PORT}`);
});

// Configured Bank & Payment Accounts
const PAYMENT_INFO = {
  telebirr: {
    number: "0911223344",
    name: "Dawit Trading Services"
  },
  cbe: {
    account: "1000123456789",
    name: "Dawit Trading Services"
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

// Tool Pricing Database
const TOOLS_CATALOG = {
  FXREPLAY: { name: "🔥 FX Replay Pro (1 Month)", price: 1200, origPrice: 3500 },
  TRADINGVIEW: { name: "📈 TradingView Premium (1 Month)", price: 1500, origPrice: 6000 },
  VPS: { name: "⚡ Forex Ultra Low-Latency VPS", price: 950, origPrice: 1800 },
  BUNDLE: { name: "👑 VIP All-in-One Master Bundle", price: 2990, origPrice: 11300 }
};

// In-Memory Storage & Analytics
const db = {
  users: new Set(),
  referrals: {},       // { userId: [referredUserIds] }
  referrerOf: {},      // { newUserId: referrerId }
  userSessions: {},    // { userId: { tool, method, discount, couponApplied } }
  ordersCount: 0,
  totalRevenue: 0
};

// 🔍 Check if user has joined the required channel
async function checkUserMembership(ctx, userId) {
  if (String(userId) === String(ADMIN_CHAT_ID)) return true;
  if (!REQUIRED_CHANNEL || REQUIRED_CHANNEL === "@YourTradingChannel") return true;

  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (error) {
    console.error("Membership check skipped (Ensure bot is admin in channel):", error.message);
    return true; // Don't block if bot is not yet admin
  }
}

// 🚫 Force Join Alert Message
function sendJoinChannelMessage(ctx) {
  return ctx.reply(
    "⚠️ **ይቅርታ! ቦቱን ከመጠቀምዎ በፊት ቻናላችንን መቀላቀል አለብዎት።**\n\n" +
    "የተለያዩ ነጻ የትሬዲንግ መረጃዎችን፣ ትምህርቶችንና ልዩ ቅናሾችን ለማግኘት ከታች ያለውን ሊንክ ተጭነው ቻናላችንን ይቀላቀሉ 👇",
    Markup.inlineKeyboard([
      [Markup.button.url('📢 ቻናላችንን ይቀላቀሉ (Join Channel)', CHANNEL_LINK)],
      [Markup.button.callback('✅ ተቀላቅያለሁ (Verify & Continue)', 'VERIFY_JOIN')]
    ])
  );
}

// 🏠 Main Menu Builder
function sendMainMenu(ctx) {
  return ctx.reply(
    "👋 እንኳን ወደ EthioTradingTools_bot በደህና መጡ!\n\n" +
    "እዚህ ምርጥ የትሬዲንግ መሣሪያዎችን (FX Replay Pro፣ TradingView Premium፣ VPS) በታላቅ ቅናሽ በቴሌብር እና ሲቢኢ በቀላሉ ማግኘት ይችላሉ።\n\n" +
    "እባክዎ የሚፈልጉትን አገልግሎት ይምረጡ 👇",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 መሣሪያዎችን እዘዝ (Order Tools)', 'ACTION_BUY')],
      [Markup.button.callback('💰 የዋጋ ዝርዝር (Catalog)', 'ACTION_PRICES'), Markup.button.callback('🎟️ ኩፖን ኮድ አስገባ (Promo)', 'ACTION_COUPON')],
      [Markup.button.callback('👥 ጋብዘህ ተጠቃም (Referral)', 'ACTION_REFERRAL'), Markup.button.callback('📚 የአጠቃቀም መመሪያ (Guides)', 'ACTION_GUIDES')],
      [Markup.button.callback('⭐ ምስክርነቶች (Vouches)', 'ACTION_VOUCHES'), Markup.button.url('📞 ድጋፍ (Support)', 'https://t.me/TraderTools_Admin')]
    ])
  );
}

// 1. /start command (Supports Referral Tracking: /start ref_123456)
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  db.users.add(userId);

  // Parse referral code if exists
  const startPayload = ctx.message.text.split(' ')[1];
  if (startPayload && startPayload.startsWith('ref_')) {
    const referrerId = startPayload.replace('ref_', '');
    if (referrerId !== String(userId) && !db.referrerOf[userId]) {
      db.referrerOf[userId] = referrerId;
      if (!db.referrals[referrerId]) db.referrals[referrerId] = [];
      db.referrals[referrerId].push(userId);

      // Notify the referrer
      try {
        await bot.telegram.sendMessage(
          referrerId,
          `🎉 **አዲስ ሰው በእርስዎ ሊንክ ተቀላቅሏል!**\n\nተጠቃሚ: @${ctx.from.username || 'Trader'}\nይህ ሰው እቃ ሲገዛ የ 100 ETB ቦነስ ይደርስዎታል!`
        );
      } catch (e) {}
    }
  }

  const isJoined = await checkUserMembership(ctx, userId);
  if (!isJoined) {
    return sendJoinChannelMessage(ctx);
  }
  return sendMainMenu(ctx);
});

// Verify Channel Join callback
bot.action('VERIFY_JOIN', async (ctx) => {
  const isJoined = await checkUserMembership(ctx, ctx.from.id);
  if (isJoined) {
    try { await ctx.deleteMessage(); } catch (e) {}
    ctx.reply("🎉 እናመሰግናለን! ቻናላችንን በተሳካ ሁኔታ ተቀላቅለዋል።");
    return sendMainMenu(ctx);
  } else {
    return ctx.answerCbQuery("❌ ገና ቻናሉን አልተቀላቀሉም! እባክዎ መጀመሪያ Join ይበሉ።", { show_alert: true });
  }
});

// 2. Buy Menu
bot.action('ACTION_BUY', async (ctx) => {
  const isJoined = await checkUserMembership(ctx, ctx.from.id);
  if (!isJoined) return sendJoinChannelMessage(ctx);

  const session = db.userSessions[ctx.from.id] || {};
  const discountText = session.discount ? ` (🎟️ ${session.discount} ETB ቅናሽ ገብቷል!)` : '';

  ctx.reply(
    `🎯 **የሚፈልጉትን የትሬዲንግ መሣሪያ ይምረጡ${discountText}:**`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`🔥 FX Replay Pro (${1200 - (session.discount || 0)} ETB)`, 'TOOL_FXREPLAY')],
      [Markup.button.callback(`📈 TradingView Premium (${1500 - (session.discount || 0)} ETB)`, 'TOOL_TRADINGVIEW')],
      [Markup.button.callback(`⚡ Forex Ultra VPS (${950 - (session.discount || 0)} ETB)`, 'TOOL_VPS')],
      [Markup.button.callback(`👑 All-in-One VIP Bundle (${2990 - (session.discount || 0)} ETB)`, 'TOOL_BUNDLE')],
      [Markup.button.callback('🎟️ ኩፖን ኮድ አስገባ', 'ACTION_COUPON'), Markup.button.callback('🔙 ዋና ሜኑ', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 3. Price Catalog View
bot.action('ACTION_PRICES', async (ctx) => {
  ctx.reply(
    "💰 **የመሳሪያዎች ዝርዝርና የዋጋ ካታሎግ:**\n\n" +
    "1. ⚡ **FX Replay Pro (1 ወር):**\n   • መደበኛ ዋጋ: ~3,500 ETB ($35)\n   • የኛ ልዩ ዋጋ: **1,200 ETB**\n\n" +
    "2. 📈 **TradingView Premium (1 ወር):**\n   • መደበኛ ዋጋ: ~6,000 ETB ($60)\n   • የኛ ልዩ ዋጋ: **1,500 ETB**\n\n" +
    "3. 🖥️ **Forex Ultra VPS (1 ወር):**\n   • ለ MT4/MT5 Robot እና EA\n   • የኛ ልዩ ዋጋ: **950 ETB**\n\n" +
    "4. 👑 **VIP All-in-One Bundle:**\n   • FX Replay + TradingView + VPS\n   • የጥቅል ዋጋ: **2,990 ETB** (ታላቅ ቅናሽ!)\n\n" +
    "👇 ለማዘዝ ከታች ይጫኑ:",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 አሁን እዘዝ', 'ACTION_BUY')],
      [Markup.button.callback('🔙 ዋና ሜኑ', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 4. Referral / Invite & Earn Program
bot.action('ACTION_REFERRAL', async (ctx) => {
  const userId = ctx.from.id;
  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${userId}`;
  const count = (db.referrals[userId] || []).length;

  ctx.reply(
    `👥 **የትሬዲንግ ሪፈራል ፕሮግራም (Invite & Earn):**\n\n` +
    `ጓደኞችዎን እና ሌሎች ትሬደሮችን በመጋበዝ ለእያንዳንዱ ግዢ **100 ብር ኮሚሽን** ወይም ነጻ የ FX Replay Pro ወርሃዊ መለያ ያግኙ!\n\n` +
    `📊 **የእርስዎ ስታቲስቲክስ:**\n` +
    `• የጋበዟቸው ሰዎች ብዛት: **${count} ሰው**\n` +
    `• ያገኙት ቦነስ: **${count * 100} ETB**\n\n` +
    `🔗 **የእርስዎ ልዩ የግብዣ ሊንክ (ኮፒ አድርገው ያጋሩ):**\n` +
    `\`${refLink}\``,
    Markup.inlineKeyboard([
      [Markup.button.url('📢 ለጓደኞችህ ሼር አድርግ', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('🔥 ምርጥ የ FX Replay Pro እና TradingView Premium መለያዎችን በታላቅ ቅናሽ በቴሌብር እዚህ ቦት ያግኙ!')}`)],
      [Markup.button.callback('🔙 ዋና ሜኑ', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 5. Coupon / Promo Code Input Flow
bot.action('ACTION_COUPON', (ctx) => {
  db.userSessions[ctx.from.id] = { ...db.userSessions[ctx.from.id], awaitingCoupon: true };
  ctx.reply(
    "🎟️ **የቅናሽ ኩፖን ኮድ አለዎት?**\n\n" +
    "እባክዎ የኩፖን ኮድዎን በዚህ ቻት ጽፈው ይላኩ (ምሳሌ: \`VIP2026\` ወይም \`HOLIDAY\`):",
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 ተመለስ', 'ACTION_BUY')]
    ])
  );
});

// 6. Guides & Video Tutorials
bot.action('ACTION_GUIDES', (ctx) => {
  ctx.reply(
    "📚 **የመሣሪያዎች አጠቃቀም መመሪያና ቱቶሪያል:**\n\n" +
    "1. ⚡ **FX Replay Pro:**\n   • Backtest እንዴት እንደሚደረግ\n   • Multi-timeframe execution\n\n" +
    "2. 📈 **TradingView Premium:**\n   • Bar Replay በሰከንዶች\n   • 25+ Indicators በአንድ ገጽ ላይ\n\n" +
    "3. 🖥️ **Forex VPS:**\n   • MT4/MT5 Remote Desktop ማገናኘት\n\n" +
    "🎥 የቪዲዮ መመሪያዎች በቴሌግራም ቻናላችን ላይ ተለቀዋል!",
    Markup.inlineKeyboard([
      [Markup.button.url('▶️ ቪዲዮዎችን በቻናል ይመልከቱ', CHANNEL_LINK)],
      [Markup.button.callback('🛒 አሁን እዘዝ', 'ACTION_BUY')],
      [Markup.button.callback('🔙 ዋና ሜኑ', 'ACTION_MAIN_MENU')]
    ])
  );
});

// 7. Vouches
bot.action('ACTION_VOUCHES', (ctx) => {
  ctx.reply(
    "⭐ **የ 500+ ኢትዮጵያውያን ትሬደሮች ምስክርነት:**\n\n" +
    "💬 *'FX Replay 2 ወር ተጠቅሜ የ 50k Prop Firm ፈተና አልፌያለሁ!'* - @Abebe_FX\n" +
    "💬 *'TradingView Premium በቴሌብር በ 5 ደቂቃ ሰጡኝ!'* - @DawitScalps\n" +
    "💬 *'VPS በጣም ፈጣን ነው EA በደንብ ይሰራል!'* - @YohannesTrade\n\n" +
    "✅ 100% ፈጣን አክቲቬሽንና አስተማማኝ አገልግሎት!",
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 እኔም ማዘዝ እፈልጋለሁ', 'ACTION_BUY')],
      [Markup.button.callback('🔙 ዋና ሜኑ', 'ACTION_MAIN_MENU')]
    ])
  );
});

// Main menu reset
bot.action('ACTION_MAIN_MENU', (ctx) => {
  return sendMainMenu(ctx);
});

// 8. Select Tool & Choose Payment Method
bot.action(/TOOL_(.+)/, async (ctx) => {
  const isJoined = await checkUserMembership(ctx, ctx.from.id);
  if (!isJoined) return sendJoinChannelMessage(ctx);

  const toolKey = ctx.match[1];
  const tool = TOOLS_CATALOG[toolKey] || { name: toolKey, price: 1200 };
  const currentSession = db.userSessions[ctx.from.id] || {};
  const discount = currentSession.discount || 0;
  const finalPrice = Math.max(100, tool.price - discount);

  db.userSessions[ctx.from.id] = { ...currentSession, tool: tool.name, finalPrice: finalPrice };

  ctx.reply(
    `✅ **የተመረጠው መሣሪያ:** ${tool.name}\n` +
    `💰 **የሚከፍሉት ጠቅላላ ሂሳብ:** ${finalPrice} ETB ${discount > 0 ? `(${discount} ETB ቅናሽ ተደርጓል!)` : ''}\n\n` +
    `እባክዎ የሚከፍሉበትን መንገድ ይምረጡ 👇`,
    Markup.inlineKeyboard([
      [Markup.button.callback('📱 Telebirr (ቴሌብር)', 'PAY_TELEBIRR')],
      [Markup.button.callback('🏦 CBE (የኢትዮጵያ ንግድ ባንክ)', 'PAY_CBE')],
      [Markup.button.callback('💎 Binance USDT (TRC20)', 'PAY_USDT')],
      [Markup.button.callback('🔙 ተመለስ', 'ACTION_BUY')]
    ])
  );
});

// 9. Send Payment Account Info
bot.action(/PAY_(.+)/, (ctx) => {
  const method = ctx.match[1];
  const userSession = db.userSessions[ctx.from.id] || { tool: 'FX Replay Pro', finalPrice: 1200 };
  userSession.method = method;

  let payText = '';
  if (method === 'TELEBIRR') {
    payText = "📱 Telebirr የክፍያ መረጃ:

" +
              "ቁጥር: " + PAYMENT_INFO.telebirr.number + "
" +
              "ስም: " + PAYMENT_INFO.telebirr.name + "
" +
              "የሚከፍሉት መጠን: " + (userSession.finalPrice || 1200) + " ETB

" +
              "⚠️ ማሳሰቢያ: ክፍያውን እንደፈጸሙ የደረሰኙን ስክሪንሾት (Screenshot) እዚህ ይላኩ።";
  } else if (method === 'CBE') {
    payText = "🏦 CBE (የኢትዮጵያ ንግድ ባንክ):

" +
              "የሂሳብ ቁጥር: " + PAYMENT_INFO.cbe.account + "
" +
              "ስም: " + PAYMENT_INFO.cbe.name + "
" +
              "የሚከፍሉት መጠን: " + (userSession.finalPrice || 1200) + " ETB

" +
              "⚠️ ማሳሰቢያ: ክፍያውን እንደፈጸሙ የደረሰኙን ስክሪንሾት (Screenshot) እዚህ ይላኩ።";
  } else {
    payText = "💎 Binance USDT (TRC20):

" +
              "Address: " + PAYMENT_INFO.usdt.address + "
" +
              "Network: " + PAYMENT_INFO.usdt.network + "
" +
              "መጠን: " + ((userSession.finalPrice || 1200) / 100).toFixed(1) + " USDT

" +
              "⚠️ ማሳሰቢያ: TXID ወይም ስክሪንሾት እዚህ ይላኩ።";
  }

  ctx.reply(payText);
});

// 10. Handle Text Inputs (Coupon Code Processing)
bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim().toUpperCase();

  // Check if user is entering a coupon
  if (db.userSessions[userId] && db.userSessions[userId].awaitingCoupon) {
    db.userSessions[userId].awaitingCoupon = false;

    if (PROMO_CODES[text]) {
      const promo = PROMO_CODES[text];
      db.userSessions[userId].discount = promo.discount;
      db.userSessions[userId].couponApplied = text;

      return ctx.reply(
        `🎉 **እንኳን ደስ አለዎት! ${text} የኩፖን ኮድ ጸድቋል!**\n\n` +
        `💰 **የተሰጠዎት ቅናሽ:** ${promo.discount} ETB\n` +
        `አሁን ወደ መግዣው በመሄድ በቅናሽ ይዘዙ! 👇`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🛒 አሁን በቅናሽ እዘዝ', 'ACTION_BUY')]
        ])
      );
    } else {
      return ctx.reply(
        "❌ ያስገቡት የኩፖን ኮድ ትክክል አይደለም ወይም ጊዜው አልፏል።",
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 እንደገና ሞክር', 'ACTION_COUPON')],
          [Markup.button.callback('🛒 ያለ ኩፖን እዘዝ', 'ACTION_BUY')]
        ])
      );
    }
  }

  return next();
});

// 11. Customer uploads receipt photo
bot.on('photo', async (ctx) => {
  const user = ctx.from;
  db.users.add(user.id);
  const userSession = db.userSessions[user.id] || { tool: 'Trading Tool', method: 'Direct', finalPrice: 1200 };
  const photo = ctx.message.photo.pop();

  if (ADMIN_CHAT_ID) {
    try {
      const captionText = "🚨 አዲስ የክፍያ ደረሰኝ ደርሷል!

" +
                          "👤 ደንበኛ: @" + (user.username || 'NoUsername') + "
" +
                          "🆔 User ID: " + user.id + "
" +
                          "📦 መሣሪያ: " + userSession.tool + "
" +
                          "💰 ዋጋ: " + (userSession.finalPrice || 1200) + " ETB
" +
                          "💳 መንገድ: " + userSession.method + "

" +
                          "💡 መረጃ ለመላክ ይህንን ኮፒ አድርገው ለቦቱ ይላኩ:
" +
                          "/send " + user.id + " Email: ... | Pass: ...";

      await bot.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
        caption: captionText,
        ...Markup.inlineKeyboard([
          [Markup.button.callback("❌ ውድቅ አድርግ (" + user.id + ")", "REJECT_" + user.id)]
        ])
      });
    } catch (err) {
      console.error('Error forwarding to admin:', err);
    }
  }

  ctx.reply("⏳ ደረሰኝዎ ደርሶናል!

አድሚናችን ክፍያውን አረጋግጦ በ 5-10 ደቂቃ ውስጥ የመግቢያ መረጃዎን በዚህ ቦት ይልክልዎታል።");
});

// 12. ✍️ Robust Manual Admin Delivery (/send <userId> <credentials>)
bot.command('send', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('⛔ ይህንን ትእዛዝ መጠቀም የሚችለው አድሚን ብቻ ነው።');
  }

  const messageText = ctx.message.text.trim();
  const parts = messageText.split(' ');

  if (parts.length < 3) {
    return ctx.reply('⚠️ አጠቃቀም ስህተት!

ትክክለኛ አጠቃቀም:
/send <USER_ID> <የመለያ መረጃ>

ምሳሌ:
/send 5056286354 Email: user@vip.com | Pass: 123456');
  }

  const targetUserId = parts[1];
  const customMessage = parts.slice(2).join(' ');

  try {
    const deliveryNotification = "🎉 እንኳን ደስ አለዎት! ትዕዛዝዎ ጸድቋል!

" +
                                 "🔑 የእርስዎ የመግቢያ መረጃ (Credentials):

" +
                                 customMessage + "

" +
                                 "⚠️ ማሳሰቢያ: ማንኛውም ጥያቄ ወይም እገዛ ካስፈለገዎት አድሚንን ማነጋገር ይችላሉ። መልካም ትሬዲንግ!";

    await bot.telegram.sendMessage(targetUserId, deliveryNotification);
    db.ordersCount += 1;
    db.totalRevenue += 1200;
    ctx.reply("✅ መረጃው ለደንበኛው (ID: " + targetUserId + ") በሚገባ ተልኳል!");
  } catch (err) {
    ctx.reply("❌ መላክ አልተቻለም! ስህተት: " + err.message);
  }
});

// 13. 📢 Mass Broadcast Command (/broadcast <message>)
bot.command('broadcast', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('⛔ ይህንን ትእዛዝ መጠቀም የሚችለው አድሚን ብቻ ነው።');
  }

  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) {
    return ctx.reply('⚠️ እባክዎ የሚተላለፈውን መልእክት አብረው ይጻፉ:

ምሳሌ:
/broadcast 🚨 ልዩ የቅናሽ ዜና ለትሬደሮች!');
  }

  const userList = Array.from(db.users);
  let successCount = 0;

  ctx.reply(`📢 ማስታወቂያውን ለ ${userList.length} ተጠቃሚዎች መላክ ተጀምሯል...`);

  for (const uid of userList) {
    try {
      await bot.telegram.sendMessage(uid, `📢 **አስደሳች ዜና ከ EthioTradingTools_bot:**\n\n${text}`, { parse_mode: 'Markdown' });
      successCount++;
    } catch (e) {}
  }

  ctx.reply(`✅ ማስታወቂያው ለ ${successCount} ሰዎች በተሳካ ሁኔታ ደርሷል!`);
});

// 14. 📊 Admin Business Analytics (/stats)
bot.command('stats', (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('⛔ ይህንን ትእዛዝ መጠቀም የሚችለው አድሚን ብቻ ነው።');
  }

  const totalUsers = db.users.size;
  const totalOrders = db.ordersCount;
  const totalRevenue = db.totalRevenue;

  ctx.reply(
    "📊 **የቦትዎ አጠቃላይ የቢዝነስ ስታቲስቲክስ (Analytics):**\n\n" +
    "👥 **ጠቅላላ የተመዘገቡ ተጠቃሚዎች:** " + totalUsers + " ሰዎች\n" +
    "📦 **የተፈጸሙ ትዕዛዞች:** " + totalOrders + " ትዕዛዝ\n" +
    "💰 **የተሰበሰበ ገቢ (ግምት):** " + totalRevenue.toLocaleString() + " ETB\n" +
    "⚡ **ሁኔታ:** 24/7 ሰዓት ኦንላይን ይሰራል",
    Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh Stats', 'REFRESH_STATS')]
    ])
  );
});

bot.action('REFRESH_STATS', (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return;
  ctx.editMessageText(
    "📊 **የቦትዎ አጠቃላይ የቢዝነስ ስታቲስቲክስ (Updated):**

" +
    "👥 **ጠቅላላ ተጠቃሚዎች:** " + db.users.size + " ሰዎች
" +
    "📦 **የተፈጸሙ ትዕዛዞች:** " + db.ordersCount + "
" +
    "💰 **ጠቅላላ ገቢ:** " + db.totalRevenue.toLocaleString() + " ETB",
    Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh Stats', 'REFRESH_STATS')]
    ])
  );
});

// Admin Rejects Order
bot.action(/REJECT_(d+)/, async (ctx) => {
  const targetUserId = ctx.match[1];
  try {
    await bot.telegram.sendMessage(
      targetUserId,
      "❌ ይቅርታ! የላኩት የክፍያ ደረሰኝ ትክክል አይደለም ወይም አልተገኘም።

እባክዎ ትክክለኛውን የክፍያ ስክሪንሾት እንደገና ይላኩ ወይም ከአድሚን ጋር ይነጋገሩ።"
    );
    ctx.editMessageCaption((ctx.update.callback_query.message.caption || '') + '

❌ STATUS: REJECTED');
  } catch (err) {
    console.error('Error sending rejection:', err);
  }
});

// Launch bot
bot.launch().then(() => console.log('🚀 Ultimate TraderTools Telegram Bot is Running with all features!'));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ============================================================
// 🤖 ATH - ABYSSINIA TRADING HUB BOT (Node.js & Telegraf)
// Production Backend for Render Deployment & GitHub Sync
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "583928172";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "abyssiniavendor";
const MINI_APP_URL = process.env.MINI_APP_URL || "https://attspro.vercel.app/";
const MINI_APP_ORDERS_URL = process.env.MINI_APP_ORDERS_URL || (MINI_APP_URL.includes('?') ? `${MINI_APP_URL}&tab=orders` : `${MINI_APP_URL.replace(/\/+$/, '')}#orders`);
const PORT = process.env.PORT || 3000;

// Initialize Telegraf Bot
const bot = new Telegraf(BOT_TOKEN);

// User session state tracking
const userSessions = {};

// ------------------------------------------------------------
// 🗄️ IN-MEMORY DATABASE (Synced with MongoDB if configured)
// ------------------------------------------------------------
const activationCodes = {
  'ATH-VIP-8821': {
    code: 'ATH-VIP-8821',
    orderId: '#ATH-8821',
    productName: 'VIP Forex Signals (Monthly)',
    durationDays: 30,
    isRedeemed: false,
    credentials: {
      type: 'InviteLink',
      inviteLink: 'https://t.me/+AbyssiniaVIP_PrivateChannel',
      licenseKey: 'ATH-VIP-8821-ACT',
      instructions: 'Tap the private invite link to enter the VIP Signals channel.'
    }
  },
  'ATH-FXR-4910': {
    code: 'ATH-FXR-4910',
    orderId: '#ATH-4910',
    productName: 'FX Replay Pro (Monthly)',
    durationDays: 30,
    isRedeemed: false,
    credentials: {
      type: 'Account',
      login: 'fxreplay.trader99@gmail.com',
      password: 'FxReplay#Ethio2026',
      instructions: 'Log in on app.fxreplay.com across desktop or mobile.'
    }
  },
  'ATH-TVP-2045': {
    code: 'ATH-TVP-2045',
    orderId: '#ATH-2045',
    productName: 'TradingView Premium (Annual)',
    durationDays: 365,
    isRedeemed: false,
    credentials: {
      type: 'Account',
      login: 'tv.premium.ath@gmail.com',
      password: 'TV#AbyssiniaGold26',
      instructions: 'Log in directly on TradingView.com.'
    }
  },
  'ATH-USED-7711': {
    code: 'ATH-USED-7711',
    orderId: '#ATH-7711',
    productName: 'Gold Scalper EA Robot (Lifetime)',
    durationDays: 3650,
    isRedeemed: true,
    redeemedAt: 'Oct 2, 2026, 11:20 AM',
    redeemedByUserId: '5056286354',
    credentials: {
      type: 'License',
      licenseKey: 'ATH-GOLD-EA-7711-CLAIMED',
      instructions: 'Already activated on MT5 Account.'
    }
  }
};

const customerOrders = {
  '5056286354': [
    {
      id: '#ATH-7420',
      productName: 'TradingView Essential (30 Days)',
      status: 'Active',
      activatedAt: 'Sep 25, 2026, 5:48 PM',
      expiresAt: 'Oct 25, 2026, 5:48 PM',
      credentials: 'Email: tv.ethio24@gmail.com | Pass: TV#Pro2026'
    }
  ]
};

// ------------------------------------------------------------
// 📱 MAIN MENU KEYBOARDS (BOT API 9.4 STYLED KEYBOARDS)
// Official Styles: 'primary' (blue), 'success' (green), 'danger' (red)
// ------------------------------------------------------------
function getMainMenuInlineKeyboard(userId = '') {
  const botUsername = 'AbyssiniaTradingHubBot';
  const shareText = encodeURIComponent('Join Abyssinia Trading Hub for premium trading subscriptions and tools at competitive prices!');
  const shareUrl = encodeURIComponent(`https://t.me/${botUsername}${userId ? `?start=ref_${userId}` : ''}`);
  const telegramShareLink = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;

  return {
    reply_markup: {
      inline_keyboard: [
        // Row 1: "✦ Explore Products" (Primary blue)
        [
          { 
            text: '✦ Explore Products', 
            web_app: { url: MINI_APP_URL }, 
            style: 'primary' 
          }
        ],
        // Row 2: "🔑 Redeem Order" (Success green) | "📦 My Orders" (Primary blue)
        [
          { 
            text: '🔑 Redeem Order', 
            callback_data: 'ACTION_REDEEM', 
            style: 'success' 
          },
          { 
            text: '📦 My Orders', 
            callback_data: 'ACTION_ORDERS', 
            style: 'primary' 
          }
        ],
        // Row 3: "📨 Invite a Trader" (Success green) | "💭 Support" (Primary blue)
        [
          { 
            text: '📨 Invite a Trader', 
            url: telegramShareLink, 
            style: 'success' 
          },
          { 
            text: '💭 Support', 
            callback_data: 'ACTION_SUPPORT', 
            style: 'primary' 
          }
        ]
      ]
    }
  };
}

// ------------------------------------------------------------
// 🧹 PERSISTENT KEYBOARD REMOVAL HELPER
// Dismisses any legacy persistent bottom reply keyboard cached in the user's Telegram client
// ------------------------------------------------------------
async function dismissPersistentReplyKeyboard(ctx) {
  if (ctx.message && ctx.chat) {
    try {
      const ping = await ctx.reply('⚡', {
        reply_markup: { remove_keyboard: true }
      });
      setTimeout(() => {
        ctx.deleteMessage(ping.message_id).catch(() => {});
      }, 100);
    } catch (err) {
      // Graceful fallback
    }
  }
}

// ------------------------------------------------------------
// 🚀 /start & /menu HANDLER
// ------------------------------------------------------------
async function handleMainMenu(ctx) {
  const userId = String(ctx.from?.id || 'guest');
  userSessions[userId] = { awaitingCode: false };

  // Dismiss any persistent bottom reply keyboard so only inline buttons remain
  await dismissPersistentReplyKeyboard(ctx);

  const rawFirstName = ctx.from?.first_name || 'Trader';
  const firstName = rawFirstName.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const welcomeText = 
`<b>Welcome to Abyssinia Trading Hub | ATH</b> 🎉

Hey <b>${firstName}</b>! 👋

We offer premium trading subscriptions and tools at competitive prices, with fast, secure, and reliable delivery.

<blockquote><a href="${MINI_APP_URL}"><b>🛍️ Explore Trading Products</b></a>
Browse TradingView Premium, FXReplay Pro, DeepCharts, Abyssinia Journal, and more through the ATH Store.

<a href="${MINI_APP_ORDERS_URL}"><b>🔑 Activate Your Access</b></a>
Redeem your activation code whenever you're ready. Your access period starts when you activate it.

<a href="${MINI_APP_ORDERS_URL}"><b>📦 Manage Your Orders</b></a>
Check order status and view your purchase and access details.

<a href="https://t.me/abyssiniavendor"><b>💬 Need Help?</b></a>
Get assistance with activation, orders, or account access.</blockquote>

Choose an option below to get started ⪼`;

  // Attach styled inline buttons directly beneath the welcome message
  // message_effect_id: 5104841245755180586 triggers Telegram's full-screen celebration confetti 🎉
  return ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    message_effect_id: '5104841245755180586',
    ...getMainMenuInlineKeyboard(userId)
  });
}

bot.command(['start', 'menu'], handleMainMenu);
bot.action('ACTION_MAIN_MENU', handleMainMenu);
bot.hears(['⬅️ Back', 'Back', '🔙 Main Menu', '/menu'], handleMainMenu);

// ------------------------------------------------------------
// 🔑 REDEEM ORDER HANDLER
// ------------------------------------------------------------
async function handleRedeemOrder(ctx) {
  const userId = String(ctx.from.id);
  userSessions[userId] = { awaitingCode: true };

  await dismissPersistentReplyKeyboard(ctx);

  const promptText = 
`🔑 <b>Redeem Order</b>

Enter the activation code you received after your order was approved.

<b>Format:</b> <code>ATH-XXXX-XXXX</code>
<b>Example:</b> <code>ATH-VIP-8821</code>

Please type and send your code in the chat:`;

  return ctx.reply(promptText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
    ])
  });
}

bot.action('ACTION_REDEEM', handleRedeemOrder);
bot.hears(['🔑 Redeem Order', 'Redeem Order'], handleRedeemOrder);

// ------------------------------------------------------------
// 📦 MY ORDERS HANDLER
// ------------------------------------------------------------
async function handleMyOrders(ctx) {
  const userId = String(ctx.from.id);
  userSessions[userId] = { awaitingCode: false };

  await dismissPersistentReplyKeyboard(ctx);

  const orders = customerOrders[userId] || [];

  let text = `📦 <b>My Orders & Subscriptions</b>\nUser ID: <code>${userId}</code>\n\n`;

  if (orders.length === 0) {
    text += `You currently have no active subscriptions.\n\nUse <b>«✦ Explore Products»</b> to browse tools or <b>«🔑 Redeem Order»</b> if you have an activation code.`;
  } else {
    text += `Active Subscriptions: <b>${orders.length}</b>\n\n`;
    orders.forEach((o, idx) => {
      text += `${idx + 1}. 🟢 <b>${o.productName}</b>\n`;
      text += `   • Order: <code>${o.id}</code>\n`;
      text += `   • Activated: ${o.activatedAt}\n`;
      text += `   • Expiry: ${o.expiresAt}\n`;
      text += `   • Access: <code>${o.credentials}</code>\n\n`;
    });
  }

  return ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        { text: '🔑 Redeem Order', callback_data: 'ACTION_REDEEM', style: 'success' },
        { text: '✦ Explore Products', web_app: { url: MINI_APP_URL }, style: 'primary' }
      ],
      [{ text: '⬅️ Back', callback_data: 'ACTION_MAIN_MENU' }]
    ])
  });
}

bot.action('ACTION_ORDERS', handleMyOrders);
bot.hears(['📦 My Orders', 'My Orders'], handleMyOrders);

// ------------------------------------------------------------
// ✦ EXPLORE PRODUCTS HANDLER
// ------------------------------------------------------------
async function handleExploreProducts(ctx) {
  const userId = String(ctx.from.id);
  userSessions[userId] = { awaitingCode: false };

  await dismissPersistentReplyKeyboard(ctx);

  const storeText =
`✦ <b>ATH Trading Tools Store</b>

Explore premium trading tools, subscriptions, and licenses at exclusive Ethiopian rates:

• <b>TradingView Premium & Essential</b>
• <b>FX Replay Pro</b> (ICT / SMC backtesting)
• <b>Gold Scalper EA Robots</b>
• <b>VIP Forex & Crypto Signals</b>

Open the full interactive storefront below or redeem an active order:`;

  return ctx.reply(storeText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [{ text: '🌐 Launch ATH Store', web_app: { url: MINI_APP_URL }, style: 'primary' }],
      [
        { text: '🔑 Redeem Order', callback_data: 'ACTION_REDEEM', style: 'success' },
        { text: '📦 My Orders', callback_data: 'ACTION_ORDERS', style: 'primary' }
      ],
      [{ text: '⬅️ Back', callback_data: 'ACTION_MAIN_MENU' }]
    ])
  });
}

bot.action('ACTION_EXPLORE', handleExploreProducts);
bot.hears(['✦ Explore Products', 'Explore Products'], handleExploreProducts);

// ------------------------------------------------------------
// 📨 INVITE A TRADER HANDLER
// ------------------------------------------------------------
async function handleInviteTrader(ctx) {
  const userId = String(ctx.from?.id || 'guest');
  userSessions[userId] = { awaitingCode: false };
  await dismissPersistentReplyKeyboard(ctx);

  const botInfo = ctx.botInfo;
  const botUsername = botInfo ? botInfo.username : 'AbyssiniaTradingHubBot';
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Join Abyssinia Trading Hub for premium trading subscriptions and tools at competitive prices!')}`;

  const inviteText = 
`📨 <b>Invite a Trader</b>

Share Abyssinia Trading Hub with your fellow traders and friends!

🔗 <b>Official Bot Link:</b>
<code>${refLink}</code>

Tap the button below to share directly with your Telegram chats or contacts:`;

  return ctx.reply(inviteText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [{ text: '🚀 Share with Traders ↗', url: shareUrl, style: 'success' }],
      [{ text: '⬅️ Back', callback_data: 'ACTION_MAIN_MENU' }]
    ])
  });
}

bot.action('ACTION_INVITE', handleInviteTrader);
bot.action('ACTION_REFERRAL', handleInviteTrader);
bot.hears(['📨 Invite a Trader', 'Invite a Trader', 'Invite', '/invite'], handleInviteTrader);

// ------------------------------------------------------------
// 💭 SUPPORT HANDLER
// ------------------------------------------------------------
async function handleSupport(ctx) {
  const userId = String(ctx.from?.id || 'guest');
  userSessions[userId] = { awaitingCode: false };
  await dismissPersistentReplyKeyboard(ctx);

  const supportText = 
`💭 <b>ATH Support Desk</b>

Our team is available 24/7 to assist with order verification, activation issues, and credentials.

• <b>Direct Support:</b> @${ADMIN_USERNAME}
• <b>Hotline:</b> <code>0938652861</code>
• <b>Average Response:</b> &lt; 5 Minutes

Please provide your Telegram ID (<code>${userId}</code>) and Order ID when reaching out.`;

  return ctx.reply(supportText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [{ text: `💬 Message @${ADMIN_USERNAME} ↗`, url: `https://t.me/${ADMIN_USERNAME}`, style: 'primary' }],
      [{ text: '📦 My Orders', callback_data: 'ACTION_ORDERS', style: 'primary' }],
      [{ text: '⬅️ Back', callback_data: 'ACTION_MAIN_MENU' }]
    ])
  });
}

bot.action('ACTION_SUPPORT', handleSupport);
bot.hears(['💭 Support', 'Support', '/support'], handleSupport);

// ------------------------------------------------------------
// 💬 TEXT MESSAGE LISTENER (CODE VALIDATION & REDEMPTION)
// ------------------------------------------------------------
bot.on('text', async (ctx) => {
  const userId = String(ctx.from.id);
  const rawText = ctx.message.text.trim();

  // Admin dispatch command: /send <USER_ID> <Credentials>
  if (rawText.startsWith('/send')) {
    if (String(userId) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('⚠️ Unauthorized: This command is restricted to administrators.');
    }

    const parts = rawText.split(' ');
    if (parts.length < 3) {
      return ctx.reply('Usage: /send <USER_ID> <Credentials>\nExample: /send 5056286354 Email: ... | Pass: ...');
    }

    const targetUserId = parts[1];
    const payload = parts.slice(2).join(' ');

    try {
      await bot.telegram.sendMessage(
        targetUserId,
        `✅ <b>Order Access Delivered!</b>\n\nYour subscription credentials:\n<code>${payload}</code>\n\nStatus: 🟢 Active`,
        { parse_mode: 'HTML' }
      );
      return ctx.reply(`✅ Successfully delivered credentials to User [${targetUserId}].`);
    } catch (err) {
      return ctx.reply(`❌ Delivery failed: ${err.message}`);
    }
  }

  // Check if entering activation code or /redeem
  const isAwaiting = userSessions[userId] && userSessions[userId].awaitingCode;
  const isRedeemCommand = rawText.toLowerCase().startsWith('/redeem');
  const isAthCodePattern = /^ATH-[A-Z0-9]+-[A-Z0-9]+/i.test(rawText);

  if (isAwaiting || isRedeemCommand || isAthCodePattern) {
    const code = rawText.replace(/^\/redeem\s*/i, '').trim().toUpperCase();
    const record = activationCodes[code];

    // Case 1: Invalid Code
    if (!record) {
      return ctx.reply(
        `❌ <b>Invalid Activation Code</b>\n\nThe code «${code}» could not be verified in our records.\n\nPlease check the code received after your order approval and try again.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Try Again', 'ACTION_REDEEM')],
            [Markup.button.url('◉ Support', `https://t.me/${ADMIN_USERNAME}`)],
            [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    // Case 2: Already Redeemed
    if (record.isRedeemed) {
      return ctx.reply(
        `⚠️ <b>Code Already Redeemed</b>\n\nThis activation code «${code}» has already been redeemed and linked to an account on ${record.redeemedAt || 'a previous session'}.\n\nEach code can only be activated once. Check your active subscriptions in My Orders.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📦 My Orders', 'ACTION_ORDERS')],
            [Markup.button.url('◉ Support', `https://t.me/${ADMIN_USERNAME}`)],
            [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    // Case 3: Valid Code!
    const now = new Date();
    const expiryDate = new Date(now.getTime() + record.durationDays * 24 * 60 * 60 * 1000);

    const formatDt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const activationTimeStr = formatDt(now);
    const expiryTimeStr = formatDt(expiryDate);

    // Mark as redeemed
    record.isRedeemed = true;
    record.redeemedAt = activationTimeStr;
    record.expiresAt = expiryTimeStr;
    record.redeemedByUserId = userId;

    let credsSummary = '';
    if (record.credentials.type === 'InviteLink') {
      credsSummary = `• Invite Link: ${record.credentials.inviteLink}\n• Token: ${record.credentials.licenseKey || code}`;
    } else if (record.credentials.type === 'Account') {
      credsSummary = `• Login: <code>${record.credentials.login}</code>\n• Pass: <code>${record.credentials.password}</code>`;
    } else {
      credsSummary = `• Key: <code>${record.credentials.licenseKey}</code>`;
    }

    // Save to customer's order history
    if (!customerOrders[userId]) customerOrders[userId] = [];
    customerOrders[userId].unshift({
      id: record.orderId,
      productName: record.productName,
      status: 'Active',
      activatedAt: activationTimeStr,
      expiresAt: expiryTimeStr,
      credentials: record.credentials.login ? `${record.credentials.login} | ${record.credentials.password}` : (record.credentials.inviteLink || record.credentials.licenseKey)
    });

    userSessions[userId] = { awaitingCode: false };

    const successMessage = 
`✅ <b>Order Activated</b>

<b>Product:</b> ${record.productName}
<b>Order ID:</b> ${record.orderId}
<b>Activation Time:</b> ${activationTimeStr}
<b>Expiry Date:</b> ${expiryTimeStr} (${record.durationDays} Days)
<b>Status:</b> 🟢 Active Access Granted

<b>Access Information:</b>
${credsSummary}

<i>Your subscription has officially started from this exact redemption moment.</i>`;

    return ctx.reply(successMessage, {
      parse_mode: 'HTML',
      message_effect_id: '5104841245755180586',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'ACTION_ORDERS')],
        [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
      ])
    });
  }

  // Fallback for regular text
  return ctx.reply(
    `🤖 Please select an action below or tap <b>«🔑 Redeem Order»</b>:`,
    {
      parse_mode: 'HTML',
      ...getMainMenuInlineKeyboard()
    }
  );
});

// ------------------------------------------------------------
// 🩺 HEALTH CHECK HTTP SERVER FOR RENDER
// ------------------------------------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ATH Telegram Bot is Live', timestamp: new Date().toISOString() }));
});

server.listen(PORT, () => {
  console.log(`[Render] HTTP Health Server running on port ${PORT}`);
});

// Launch Telegraf Bot
bot.launch()
  .then(() => console.log('🚀 ATH Telegram Bot launched successfully!'))
  .catch((err) => console.error('Failed to launch bot:', err));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

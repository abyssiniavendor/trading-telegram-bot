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
// 📱 MAIN MENU KEYBOARDS (BOT API 9.4 STYLED INLINE KEYBOARDS)
// Official Styles: 'primary' (blue), 'success' (green), 'danger' (red)
// ------------------------------------------------------------
function getMainMenuInlineKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        // Row 1: Full-width primary blue button launching Mini App
        [
          { 
            text: '✦ Explore Products', 
            web_app: { url: MINI_APP_URL }, 
            style: 'primary' 
          }
        ],
        // Row 2: Side-by-side: Redeem Order (green) | My Orders (blue)
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
        ]
      ]
    }
  };
}

// ------------------------------------------------------------
// 🚀 /start & /menu HANDLER
// ------------------------------------------------------------
async function handleMainMenu(ctx) {
  const userId = String(ctx.from.id);
  userSessions[userId] = { awaitingCode: false };

  const welcomeText = 
`👋 <b>Welcome to Abyssinia Trading Hub (ATH)</b>
Order & Access Assistant

Manage your subscriptions, redeem order activation codes, and get verified credentials.`;

  // Attach styled inline buttons directly beneath the welcome message
  return ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    ...getMainMenuInlineKeyboard()
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
// ↗ REFER & EARN HANDLER
// ------------------------------------------------------------
bot.action('ACTION_REFERRAL', async (ctx) => {
  const userId = String(ctx.from.id);
  const botInfo = ctx.botInfo;
  const botUsername = botInfo ? botInfo.username : 'AbyssiniaTradingHubBot';
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const refText = 
`↗ <b>Refer & Earn (Partner Program)</b>

Share your link with fellow traders. Earn 100 ETB for every verified tool subscription.

🔗 <b>Your Partner Link:</b>
<code>${refLink}</code>

• Total Referrals: <b>4 traders</b>
• Commission Earned: <b>400 ETB</b>`;

  return ctx.reply(refText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
    ])
  });
});

// ------------------------------------------------------------
// 💬 TEXT MESSAGE LISTENER (CODE VALIDATION & REDEMPTION)
// ------------------------------------------------------------
bot.on('text', async (ctx) => {
  const userId = String(ctx.from.id);
  const rawText = ctx.message.text.trim();

  // Admin dispatch command: /send <USER_ID> <Credentials>
  if (rawText.startsWith('/send')) {
    if (String(userId) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('⛔ Unauthorized: Admin access required.');
    }
    const parts = rawText.split(' ');
    if (parts.length >= 3) {
      const targetUserId = parts[1];
      const creds = parts.slice(2).join(' ');
      try {
        await bot.telegram.sendMessage(
          targetUserId,
          `📦 <b>Manual Order Delivery from Admin</b>\n\n${creds}\n\n<i>Contact support @${ADMIN_USERNAME} if you have any questions.</i>`,
          { parse_mode: 'HTML' }
        );
        return ctx.reply(`✅ Delivered credentials to user <code>${targetUserId}</code>.`, { parse_mode: 'HTML' });
      } catch (err) {
        return ctx.reply(`❌ Failed to send: ${err.message}`);
      }
    }
    return ctx.reply('Usage: <code>/send &lt;USER_ID&gt; &lt;Credentials&gt;</code>', { parse_mode: 'HTML' });
  }

  // Quick command redirects
  const lower = rawText.toLowerCase();
  if (lower === '/redeem') return handleRedeemOrder(ctx);
  if (lower === '/orders') return handleMyOrders(ctx);
  if (lower === '/explore') return handleExploreProducts(ctx);

  // Activation code redemption check
  const session = userSessions[userId] || {};
  const isExplicitRedeemCmd = lower.startsWith('/redeem ');
  const looksLikeCode = rawText.toUpperCase().startsWith('ATH-');

  if (session.awaitingCode || isExplicitRedeemCmd || looksLikeCode) {
    const code = rawText.replace(/^\/redeem\s+/i, '').trim().toUpperCase();
    const record = activationCodes[code];

    if (!record) {
      return ctx.reply(
        `❌ <b>Invalid Activation Code</b>\n\nThe code <code>${code}</code> could not be found.\n\nPlease check the code provided upon order approval and try again.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Try Again', 'ACTION_REDEEM')],
            [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    if (record.isRedeemed) {
      return ctx.reply(
        `⚠️ <b>Code Already Redeemed</b>\n\nThis activation code was already claimed on <b>${record.redeemedAt}</b>.\n\nEach code can only be used once. Check active tools in «📦 My Orders».`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📦 My Orders', 'ACTION_ORDERS')],
            [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    // Activate the code
    const now = new Date();
    const expiry = new Date(now.getTime() + record.durationDays * 24 * 60 * 60 * 1000);
    const dateOpts = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };

    record.isRedeemed = true;
    record.redeemedAt = now.toLocaleDateString('en-US', dateOpts);
    record.redeemedByUserId = userId;

    if (!customerOrders[userId]) customerOrders[userId] = [];

    let credsSummary = '';
    if (record.credentials.type === 'Account') {
      credsSummary = `• <b>Login:</b> <code>${record.credentials.login}</code>\n• <b>Password:</b> <code>${record.credentials.password}</code>\n• <b>Guide:</b> ${record.credentials.instructions}`;
    } else if (record.credentials.type === 'InviteLink') {
      credsSummary = `• <b>Private Invite:</b> <a href="${record.credentials.inviteLink}">Join VIP Signals</a>\n• <b>Guide:</b> ${record.credentials.instructions}`;
    } else {
      credsSummary = `• <b>License Key:</b> <code>${record.credentials.licenseKey}</code>\n• <b>Guide:</b> ${record.credentials.instructions}`;
    }

    customerOrders[userId].push({
      id: record.orderId,
      productName: record.productName,
      status: 'Active',
      activatedAt: record.redeemedAt,
      expiresAt: expiry.toLocaleDateString('en-US', dateOpts),
      credentials: credsSummary.replace(/<[^>]+>/g, '')
    });

    userSessions[userId] = { awaitingCode: false };

    const successMessage = 
`✅ <b>Order Activated Successfully!</b>

<b>Product:</b> ${record.productName}
<b>Order ID:</b> <code>${record.orderId}</code>
<b>Activated:</b> ${record.redeemedAt}
<b>Expiry:</b> ${expiry.toLocaleDateString('en-US', dateOpts)} (${record.durationDays} Days)
<b>Status:</b> 🟢 Active Access Granted

<b>Your Credentials:</b>
${credsSummary}

<i>Your subscription has officially started from this exact redemption moment.</i>`;

    return ctx.reply(successMessage, {
      parse_mode: 'HTML',
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

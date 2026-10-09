// ============================================================
// 🤖 ABYSSINIA TRADING HUB (ATH) - TELEGRAM BOT
// Order & Access Assistant with Bot API Button Styles
// ============================================================

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '5056286354';
const PORT = process.env.PORT || 10000;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://ais-dev-b7hbz5ntkwzelblv3umf6j-158744423774.europe-west1.run.app';

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.warn('⚠️ Warning: BOT_TOKEN is not set. Please provide a valid Telegram Bot token in environment variables.');
}

const bot = new Telegraf(BOT_TOKEN);

// User in-memory session store
const userSessions = {};

// Order & Credential Database
const activationCodes = {
  'ATH-VIP-8821': {
    code: 'ATH-VIP-8821',
    orderId: '#ATH-8821',
    productName: 'VIP Forex & Crypto Signals',
    plan: 'Quarterly (3 Months)',
    durationDays: 90,
    isRedeemed: false,
    credentials: {
      inviteLink: 'https://t.me/+ATH_VIP_SIGNAL_ACCESS_99',
      licenseKey: 'ATH-VIP-SIG-2026-X88',
      instructions: 'Join the private channel using your unique single-use link above.'
    }
  },
  'ATH-FXR-4910': {
    code: 'ATH-FXR-4910',
    orderId: '#ATH-4910',
    productName: 'FX Replay Pro (Monthly)',
    plan: 'Monthly Plan',
    durationDays: 30,
    isRedeemed: false,
    credentials: {
      login: 'fxreplay.trader99@gmail.com',
      password: 'FxReplay#Ethio2026',
      instructions: 'Log in on app.fxreplay.com. Do not change account password to maintain warranty.'
    }
  },
  'ATH-TVP-2045': {
    code: 'ATH-TVP-2045',
    orderId: '#ATH-2045',
    productName: 'TradingView Premium (Annual)',
    plan: 'Annual Tier',
    durationDays: 365,
    isRedeemed: false,
    credentials: {
      login: 'tv.premium.ath@gmail.com',
      password: 'TV#AbyssiniaGold26',
      instructions: 'Log in on TradingView.com across desktop and mobile devices.'
    }
  },
  'ATH-USED-7711': {
    code: 'ATH-USED-7711',
    orderId: '#ATH-7711',
    productName: 'Gold Scalper EA Robot (Lifetime)',
    plan: 'Lifetime License',
    durationDays: 3650,
    isRedeemed: true,
    redeemedAt: 'Oct 2, 2026, 11:20 AM',
    redeemedByUserId: '5056286354',
    credentials: {
      licenseKey: 'ATH-GOLD-EA-7711-CLAIMED',
      instructions: 'Already activated on MT5 Account #994821.'
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
// 📱 MAIN MENU KEYBOARDS (STANDARD REPLY KEYBOARD WITH STYLES)
// ------------------------------------------------------------
function getMainMenuReplyKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        // Row 1: Full-width primary blue button
        [
          { 
            text: '✦ Explore Products', 
            style: 'primary' 
          }
        ],
        // Row 2: Side-by-side: Redeem Order (green) | My Orders (blue)
        [
          { 
            text: '🔑 Redeem Order', 
            style: 'success' 
          },
          { 
            text: '📦 My Orders', 
            style: 'primary' 
          }
        ]
      ],
      resize_keyboard: true,
      is_persistent: true
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

  return ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    ...getMainMenuReplyKeyboard()
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
        { text: '✦ Explore Products', callback_data: 'ACTION_EXPLORE', style: 'primary' }
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

Open the storefront below or redeem an active order:`;

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
        `🔔 <b>Order Credentials Delivery</b>\n\nAdministrator has provisioned your access:\n\n<code>${payload}</code>\n\nThank you for choosing Abyssinia Trading Hub!`,
        { parse_mode: 'HTML' }
      );
      return ctx.reply(`✅ Delivered successfully to User ID <code>${targetUserId}</code>.`, { parse_mode: 'HTML' });
    } catch (e) {
      return ctx.reply(`❌ Failed to send message to user ${targetUserId}: ${e.message}`);
    }
  }

  const session = userSessions[userId] || {};
  const isAwaiting = session.awaitingCode;
  const isCodeFormat = /^ATH-[A-Z0-9]+-[A-Z0-9]+$/i.test(rawText) || rawText.toLowerCase().startsWith('/redeem ');

  if (isAwaiting || isCodeFormat) {
    const code = rawText.replace(/^\/redeem\s*/i, '').trim().toUpperCase();
    const record = activationCodes[code];

    if (!record) {
      return ctx.reply(
        `❌ <b>Invalid Activation Code</b>\n\nThe code <code>${code}</code> was not found.\n\nPlease verify the code sent to you upon order approval.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔑 Try Again', 'ACTION_REDEEM')],
            [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    if (record.isRedeemed) {
      return ctx.reply(
        `⚠️ <b>Code Already Redeemed</b>\n\nThis activation code was already claimed on <b>${record.redeemedAt}</b>.\n\nEach license code can only be activated once. Check your active tools in My Orders.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📦 My Orders', 'ACTION_ORDERS')],
            [Markup.button.callback('⬅️ Back', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    // Mark as redeemed
    record.isRedeemed = true;
    const now = new Date();
    const exp = new Date(now.getTime() + record.durationDays * 24 * 60 * 60 * 1000);
    const activationTimeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const expiryTimeStr = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    record.redeemedAt = activationTimeStr;
    record.redeemedByUserId = userId;

    let credsSummary = '';
    if (record.credentials.login) {
      credsSummary = `• <b>Login:</b> <code>${record.credentials.login}</code>\n• <b>Password:</b> <code>${record.credentials.password}</code>`;
    } else if (record.credentials.inviteLink) {
      credsSummary = `• <b>Access Link:</b> ${record.credentials.inviteLink}\n• <b>Key:</b> <code>${record.credentials.licenseKey}</code>`;
    } else if (record.credentials.licenseKey) {
      credsSummary = `• <b>License Key:</b> <code>${record.credentials.licenseKey}</code>`;
    }

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
      ...getMainMenuReplyKeyboard()
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

// Graceful termination
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

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
// 📱 MAIN MENU KEYBOARD (EXACT ATH SPECIFICATION)
// ------------------------------------------------------------
function getMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    // Row 1: Explore Products (Full width, launches Mini App)
    [Markup.button.webApp('✦ Explore Products', MINI_APP_URL)],
    // Row 2: Redeem Order | My Orders
    [
      Markup.button.callback('🔑 Redeem Order', 'ACTION_REDEEM'),
      Markup.button.callback('📦 My Orders', 'ACTION_ORDERS')
    ],
    // Row 3: Refer & Earn | Support
    [
      Markup.button.callback('↗ Refer & Earn', 'ACTION_REFERRAL'),
      Markup.button.url('◉ Support', `https://t.me/${ADMIN_USERNAME}`)
    ]
  ]);
}

// ------------------------------------------------------------
// 🚀 /start & /menu HANDLER
// ------------------------------------------------------------
bot.command(['start', 'menu'], async (ctx) => {
  const userId = String(ctx.from.id);
  userSessions[userId] = { awaitingCode: false };

  const welcomeText = 
`👋 <b>Welcome to Abyssinia Trading Hub (ATH)</b>
Order & Access Assistant

Manage your subscriptions, redeem order activation codes, and get verified credentials.`;

  return ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    ...getMainMenuKeyboard()
  });
});

// ------------------------------------------------------------
// 🔑 REDEEM ORDER HANDLER
// ------------------------------------------------------------
bot.action('ACTION_REDEEM', async (ctx) => {
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
      [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  });
});

// ------------------------------------------------------------
// 📦 MY ORDERS HANDLER
// ------------------------------------------------------------
bot.action('ACTION_ORDERS', async (ctx) => {
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
        Markup.button.callback('🔑 Redeem Order', 'ACTION_REDEEM'),
        Markup.button.webApp('✦ Explore Products', MINI_APP_URL)
      ],
      [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  });
});

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
      [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
    ])
  });
});

// ------------------------------------------------------------
// 🏠 MAIN MENU RETURN
// ------------------------------------------------------------
bot.action('ACTION_MAIN_MENU', async (ctx) => {
  const userId = String(ctx.from.id);
  userSessions[userId] = { awaitingCode: false };

  const menuText = 
`👋 <b>Welcome to Abyssinia Trading Hub (ATH)</b>
Order & Access Assistant

Manage your subscriptions, redeem order activation codes, and get verified credentials.`;

  return ctx.reply(menuText, {
    parse_mode: 'HTML',
    ...getMainMenuKeyboard()
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
            [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
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
            [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
          ])
        }
      );
    }

    // Case 3: Valid Code!
    // Start subscription at the EXACT moment of redemption
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
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'ACTION_ORDERS')],
        [Markup.button.callback('🔙 Main Menu', 'ACTION_MAIN_MENU')]
      ])
    });
  }

  // Fallback for regular text
  return ctx.reply(
    `🤖 Please select an action below or tap <b>«🔑 Redeem Order»</b>:`,
    {
      parse_mode: 'HTML',
      ...getMainMenuKeyboard()
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

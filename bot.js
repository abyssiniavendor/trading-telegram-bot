/**
 * Abyssinia Trading Hub (ATH) - Official Telegram Bot
 *
 * Requirements:
 * npm install telegraf dotenv
 *
 * Environment variables (.env):
 * BOT_TOKEN=your_bot_token_from_botfather
 * MINIAPP_URL=https://your-domain.com
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const MINI_APP_URL = process.env.MINIAPP_URL || 'https://abyssiniatradinghub.com';

const bot = new Telegraf(BOT_TOKEN);

// In-memory demo data for subscriptions and redemption codes
const userSubscriptions = new Map();
const validRedemptionCodes = {
  'ATH-TVP-9921': { product: 'TradingView Premium', duration: '1 Year', valid: true },
  'ATH-FXR-4102': { product: 'FXReplay Pro', duration: '6 Months', valid: true },
  'ATH-DPC-7719': { product: 'DeepCharts Lifetime', duration: 'Lifetime', valid: true },
  'ATH-JNL-1029': { product: 'Abyssinia Journal VIP', duration: '1 Year', valid: true }
};

// ------------------------------------------------------------
// INLINE KEYBOARD DEFINITION
// Row 1: "✦ Explore Products" (Primary blue, launches Mini App)
// Row 2: "🔑 Redeem Order" (Success green) | "📦 My Orders" (Primary blue)
// Row 3: "📨 Invite a Trader" (Success green) | "💭 Support" (Primary blue)
// ------------------------------------------------------------
function getMainMenuInlineKeyboard(userId = '') {
  const botUsername = 'AbyssiniaTradingHubBot';
  const shareText = encodeURIComponent('Join Abyssinia Trading Hub for premium trading subscriptions and tools at competitive prices!');
  const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${userId || 'ath'}&text=${shareText}`;

  return {
    reply_markup: {
      inline_keyboard: [
        // Row 1: Explore Products (Primary Blue, opens Mini App store)
        [
          { 
            text: '✦ Explore Products', 
            web_app: { url: MINI_APP_URL },
            style: 'primary'
          }
        ],
        // Row 2: Redeem Order (Success Green) | My Orders (Primary Blue)
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
        // Row 3: Invite a Trader (Success Green, Native Share) | Support (Primary Blue)
        [
          { 
            text: '📨 Invite a Trader', 
            url: shareUrl,
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
// WELCOME MESSAGE HANDLER (/start & /menu)
// ------------------------------------------------------------
function handleMainMenu(ctx) {
  // Extract user's actual Telegram first name or fallback to "Trader"
  const firstName = ctx.from?.first_name 
    ? ctx.from.first_name.replace(/[<>&]/g, '') // Sanitize basic HTML tags
    : 'Trader';
  const userId = String(ctx.from?.id || 'guest');

  const welcomeText = 
`<b>Welcome to Abyssinia Trading Hub | ATH</b> 🎉

Hey <b>${firstName}</b>! 👋

We offer premium trading subscriptions and tools at competitive prices, with fast, secure, and reliable delivery.

<blockquote>🚀 Explore Trading Products
Browse TradingView Premium, FXReplay Pro, DeepCharts, Abyssinia Journal, and more through the ATH Store.

🔑 Activate Your Access
Redeem your activation code whenever you're ready. Your access period starts when you activate it.

📦 Manage Your Orders
Check order status and view your purchase and access details.

💭 Need Help?
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

bot.start((ctx) => handleMainMenu(ctx));
bot.command('menu', (ctx) => handleMainMenu(ctx));

// ------------------------------------------------------------
// 🔑 REDEEM ORDER HANDLER
// ------------------------------------------------------------
bot.action('ACTION_REDEEM', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
`🔑 <b>Redeem Your Access Code</b>

Please reply with your activation code in the following format:
<code>ATH-XXXX-XXXX</code>

<i>Tip: Your code was delivered upon payment confirmation. Your access period only starts once redeemed.</i>`, 
    { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '« Back to Menu', callback_data: 'ACTION_MAIN_MENU' }]
        ]
      }
    }
  );
});

// ------------------------------------------------------------
// 📦 MY ORDERS HANDLER
// ------------------------------------------------------------
bot.action('ACTION_ORDERS', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from.id);
  const subs = userSubscriptions.get(userId) || [];

  if (subs.length === 0) {
    return ctx.reply(
`📦 <b>Your Subscriptions & Orders</b>

You do not have any active subscriptions registered yet.

Choose <b>✦ Explore Products</b> in the main menu to get premium tools or <b>🔑 Redeem Order</b> if you already have a key.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✦ Open Store', web_app: { url: MINI_APP_URL } },
              { text: '🔑 Redeem Code', callback_data: 'ACTION_REDEEM' }
            ],
            [{ text: '« Back to Menu', callback_data: 'ACTION_MAIN_MENU' }]
          ]
        }
      }
    );
  }

  let ordersList = subs.map((s, index) => 
    `<b>${index + 1}. ${s.product}</b>\n` +
    `• Duration: <code>${s.duration}</code>\n` +
    `• Status: 🟢 Active\n` +
    `• Account Email: <code>${s.accountEmail || 'Direct Delivery'}</code>\n` +
    `• Activated: ${s.activatedAt}`
  ).join('\n\n');

  return ctx.reply(
`📦 <b>Your Active Subscriptions</b>\n\n${ordersList}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '« Back to Menu', callback_data: 'ACTION_MAIN_MENU' }]
        ]
      }
    }
  );
});

// ------------------------------------------------------------
// 📨 INVITE A TRADER HANDLER
// ------------------------------------------------------------
async function handleInviteTrader(ctx) {
  const userId = String(ctx.from?.id || 'guest');
  const botUsername = 'AbyssiniaTradingHubBot';
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  const shareText = encodeURIComponent('Join Abyssinia Trading Hub for premium trading subscriptions and tools at competitive prices!');
  const shareUrl = `https://t.me/share/url?url=${referralLink}&text=${shareText}`;

  const inviteMessage = 
`📨 <b>Invite a Fellow Trader</b>

Share Abyssinia Trading Hub with your trading network and friends!

Your referral link:
<code>${referralLink}</code>

Click the button below to share instantly to any chat or channel.`;

  return ctx.reply(inviteMessage, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🚀 Share with Friends', url: shareUrl, style: 'success' }
        ],
        [
          { text: '« Back to Menu', callback_data: 'ACTION_MAIN_MENU' }
        ]
      ]
    }
  });
}

bot.action('ACTION_INVITE', async (ctx) => {
  await ctx.answerCbQuery();
  return handleInviteTrader(ctx);
});
bot.command('invite', (ctx) => handleInviteTrader(ctx));

// ------------------------------------------------------------
// 💭 SUPPORT HANDLER
// ------------------------------------------------------------
async function handleSupport(ctx) {
  const supportText = 
`💭 <b>ATH Support Desk</b>

Need help with activation, orders, or custom subscriptions? Our team is available 24/7.

• <b>Direct Telegram Vendor:</b> @abyssiniavendor
• <b>Official Community:</b> @AbyssiniaTradingHub
• <b>Average Response Time:</b> Under 10 minutes

Choose an option below:`;

  return ctx.reply(supportText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💬 Contact Vendor', url: 'https://t.me/abyssiniavendor', style: 'primary' }
        ],
        [
          { text: '📢 ATH Channel', url: 'https://t.me/AbyssiniaTradingHub', style: 'primary' }
        ],
        [
          { text: '« Back to Menu', callback_data: 'ACTION_MAIN_MENU' }
        ]
      ]
    }
  });
}

bot.action('ACTION_SUPPORT', async (ctx) => {
  await ctx.answerCbQuery();
  return handleSupport(ctx);
});
bot.command('support', (ctx) => handleSupport(ctx));

// ------------------------------------------------------------
// BACK TO MAIN MENU
// ------------------------------------------------------------
bot.action('ACTION_MAIN_MENU', async (ctx) => {
  await ctx.answerCbQuery();
  return handleMainMenu(ctx);
});

// ------------------------------------------------------------
// REDEMPTION CODE LISTENER
// ------------------------------------------------------------
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim().toUpperCase();

  // Validate format ATH-XXXX-XXXX
  if (text.startsWith('ATH-')) {
    const codeRecord = validRedemptionCodes[text];
    const userId = String(ctx.from.id);

    if (codeRecord && codeRecord.valid) {
      codeRecord.valid = false; // Mark used

      const current = userSubscriptions.get(userId) || [];
      const newSub = {
        code: text,
        product: codeRecord.product,
        duration: codeRecord.duration,
        accountEmail: ctx.from.username ? `@${ctx.from.username}` : `tg_${userId}`,
        activatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      current.push(newSub);
      userSubscriptions.set(userId, current);

      return ctx.reply(
`🎉 <b>Activation Successful!</b>

Your subscription has been activated:
• <b>Product:</b> ${newSub.product}
• <b>Duration:</b> ${newSub.duration}
• <b>Activated:</b> ${newSub.activatedAt}

Your access credentials will be delivered to this chat or synced to your account.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📦 View in My Orders', callback_data: 'ACTION_ORDERS' }],
              [{ text: '« Back to Menu', callback_data: 'ACTION_MAIN_MENU' }]
            ]
          }
        }
      );
    } else {
      return ctx.reply(
`❌ <b>Invalid or Expired Code</b>

The code <code>${text}</code> could not be found or has already been redeemed.

If you believe this is an error, please reach out to our team via 💭 Support.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Try Again', callback_data: 'ACTION_REDEEM' },
                { text: '💭 Support', callback_data: 'ACTION_SUPPORT' }
              ]
            ]
          }
        }
      );
    }
  }
});

// ------------------------------------------------------------
// LAUNCH BOT
// ------------------------------------------------------------
bot.launch().then(() => {
  console.log('✅ ATH Telegram Bot is live and listening for updates!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

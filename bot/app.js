require('dotenv').config();

const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');

const User = require('./models/User');
const Withdraw = require('./models/Withdraw');

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);
const CHANNEL = process.env.CHANNEL_USERNAME;

/* ---------------- DB ---------------- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

/* ---------------- SESSION ---------------- */
bot.use(session());

/* ---------------- FORCE JOIN CHECK ---------------- */
async function isJoined(userId, ctx) {
  try {
    const res = await ctx.telegram.getChatMember(CHANNEL, userId);
    return ['member', 'administrator', 'creator'].includes(res.status);
  } catch (err) {
    return false;
  }
}

/* ---------------- GLOBAL FORCE JOIN MIDDLEWARE ---------------- */
bot.use(async (ctx, next) => {
  if (!ctx.from) return;

  const ok = await isJoined(ctx.from.id, ctx);

  if (!ok) {
    return ctx.reply(
      '⚠️ Join our channel to use this bot.',
      Markup.inlineKeyboard([
        [Markup.button.url('📢 Join Channel', `https://t.me/${CHANNEL.replace('@','')}`)],
        [Markup.button.callback('🔄 Verify', 'verify')]
      ])
    );
  }

  return next();
});

/* ---------------- MAIN MENU ---------------- */
function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 Wallet', 'wallet'),
      Markup.button.callback('👥 Refer', 'refer')
    ],
    [
      Markup.button.callback('🏧 Withdraw', 'withdraw'),
    ]
  ]);
}

/* ---------------- START ---------------- */
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const ref = ctx.startPayload;

  let user = await User.findOne({ userId });

  if (!user) {
    user = await User.create({
      userId,
      name: ctx.from.first_name,
      username: ctx.from.username,
      balance: 0
    });

    // referral reward
    if (ref && Number(ref) !== userId) {
      const refUser = await User.findOne({ userId: Number(ref) });

      if (refUser) {
        refUser.balance += 2;
        await refUser.save();
      }
    }
  }

  return ctx.reply('Welcome to bot 👇', mainMenu());
});

/* ---------------- VERIFY ---------------- */
bot.action('verify', async (ctx) => {
  const ok = await isJoined(ctx.from.id, ctx);

  if (ok) {
    return ctx.reply('✅ Verified successfully!', mainMenu());
  } else {
    return ctx.answerCbQuery('❌ You have not joined yet', { show_alert: true });
  }
});

/* ---------------- WALLET ---------------- */
bot.action('wallet', async (ctx) => {
  const user = await User.findOne({ userId: ctx.from.id });

  return ctx.reply(`💰 Balance: ${user.balance}`);
});

/* ---------------- WITHDRAW FLOW ---------------- */
bot.action('withdraw', async (ctx) => {
  ctx.session.step = 'amount';

  return ctx.reply('💸 Enter withdrawal amount:');
});

/* ---------------- TEXT HANDLER ---------------- */
bot.on('text', async (ctx) => {
  if (!ctx.session) return;

  const user = await User.findOne({ userId: ctx.from.id });

  // STEP 1: amount
  if (ctx.session.step === 'amount') {
    const amount = Number(ctx.message.text);

    if (!amount || amount <= 0) {
      return ctx.reply('❌ Invalid amount');
    }

    if (amount > user.balance) {
      return ctx.reply('❌ Not enough balance');
    }

    ctx.session.amount = amount;
    ctx.session.step = 'wallet';

    return ctx.reply('📥 Send your wallet / UPI:');
  }

  // STEP 2: wallet
  if (ctx.session.step === 'wallet') {
    const wallet = ctx.message.text;
    const amount = ctx.session.amount;

    user.balance -= amount;
    await user.save();

    const req = await Withdraw.create({
      userId: ctx.from.id,
      amount,
      wallet
    });

    ctx.session = null;

    // notify admin
    ctx.telegram.sendMessage(
      ADMIN_ID,
      `💸 WITHDRAW REQUEST

User: ${ctx.from.first_name}
ID: ${ctx.from.id}
Amount: ${amount}
Wallet: ${wallet}`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Approve', `approve_${req._id}`),
        Markup.button.callback('❌ Reject', `reject_${req._id}`)
      ])
    );

    return ctx.reply('✅ Withdrawal request sent');
  }
});

/* ---------------- ADMIN APPROVE ---------------- */
bot.action(/approve_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const id = ctx.match[1];

  const req = await Withdraw.findById(id);
  if (!req || req.status !== 'pending') return;

  req.status = 'approved';
  await req.save();

  await ctx.telegram.sendMessage(req.userId, '✅ Withdrawal approved!');

  return ctx.answerCbQuery('Approved');
});

/* ---------------- ADMIN REJECT ---------------- */
bot.action(/reject_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const id = ctx.match[1];

  const req = await Withdraw.findById(id);
  if (!req || req.status !== 'pending') return;

  req.status = 'rejected';
  await req.save();

  const user = await User.findOne({ userId: req.userId });
  user.balance += req.amount;
  await user.save();

  await ctx.telegram.sendMessage(req.userId, '❌ Withdrawal rejected & refunded');

  return ctx.answerCbQuery('Rejected');
});

/* ---------------- LAUNCH ---------------- */
bot.launch();
console.log('🤖 Bot is running...');

require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log(err));

const ADMIN_ID = Number(process.env.ADMIN_ID);
const CHANNEL = process.env.CHANNEL_USERNAME;

// FORCE JOIN CHECK
async function isJoined(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);

    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

// MAIN MENU
function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 Wallet', 'wallet'),
      Markup.button.callback('👥 Refer', 'refer')
    ],
    [
      Markup.button.callback('🏧 Withdraw', 'withdraw'),
      Markup.button.callback('🏆 Leaderboard', 'leaderboard')
    ],
    [
      Markup.button.callback('📞 Support', 'support')
    ]
  ]);
}

// START COMMAND
bot.start(async (ctx) => {

  const joined = await isJoined(ctx);

  if (!joined) {
    return ctx.reply(
      '⚠️ Please join our channel first.',
      Markup.inlineKeyboard([
        [Markup.button.url('Join Channel', `https://t.me/${CHANNEL.replace('@', '')}`)],
        [Markup.button.callback('✅ Verify', 'verify')]
      ])
    );
  }

  const userId = ctx.from.id;
  const referrerId = ctx.startPayload;

  let user = await User.findOne({ userId });

  if (!user) {

    user = await User.create({
      userId,
      name: ctx.from.first_name,
      username: ctx.from.username
    });

    // REFERRAL SYSTEM
    if (referrerId && referrerId != userId) {

      const referrer = await User.findOne({ userId: Number(referrerId) });

      if (referrer) {
        referrer.balance += 2;
console.log('Ambani Loot Bot Running...');
const puppeteer = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(Stealth());
const axios = require('axios');
const cheerio = require('cheerio');
const pluginProxy = require('puppeteer-extra-plugin-proxy');
const Chance = require('chance');
const path = require('path');
const fs = require('fs');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const chance = new Chance();
const mailrutoken = 'bac8475cff25d8ae443caaa42a23ce2e';
const BOT_TOKEN = '6722447653:AAEzIdyGs9l0MD9_QpJ8GFzM96EpDmlwihQ';

// Proxy listesi
const proxyList = [
    "94.74.159.234:50100:cU2kNl:j3Tq8Y",
];

// Rastgele Türk isim ve soyisimler
const turkishNames = [
  "AHMET", "MEHMET", "MUSTAFA", "YUSUF", "ALİ", "HÜSEYİN", "OSMAN", "ÖMER", "MURAT", "FATİH",
  "EMRE", "İBRAHİM", "HALİL", "HASAN", "CAN", "BURAK", "OĞUZHAN", "EMİR", "FURKAN", "EREN",
  "SERKAN", "OKAN", "MERT", "YILMAZ", "CEM", "ENES", "VOLKAN", "BARIŞ", "HAKAN", "KEREM",
  "BERK", "YUNUS", "SERDAR", "DOĞAN", "UĞUR", "GÖKHAN", "SALİH", "CENK", "KAAN", "MEHMET ALİ",
  "ONUR", "DENİZ", "TAYFUN", "KEMAL", "ORHAN", "SEMİH", "LEVENT", "ADEM", "METİN", "MURAT",
  "CEMAL", "ERKAN", "MAHMUT", "SÜLEYMAN", "FERHAT", "ŞÜKRÜ", "EMİN", "YAVUZ", "MUHARREM", "İSMAİL",
  "FIRAT", "SİNAN", "TOLGA", "TANER", "AYHAN", "KADİR", "BATUHAN", "ALPER", "YASİN", "UMUT",
  "GÜRKAN", "SAMET", "RIZA", "BİLAL", "SAVAŞ", "ÖZGÜR", "YALÇIN", "TAMER", "RAHMİ", "ALPARSLAN",
  "ENGİN", "ERHAN", "İLKER", "İHSAN", "KORAY", "CİHAN", "ALİHAN", "VEDAT", "TARIK", "BÜLENT",
  "FAHRİ", "ERAY", "ATİLLA", "NECATİ", "SELİM", "TUNCAY", "YUSUF", "HARUN", "LÜTFİ", "CENGİZ"
];

const turkishSurnames = [
  "YILMAZ", "KAYA", "DEMİR", "ŞAHİN", "ÇELİK", "YILDIZ", "YILDIRIM", "ÖZTÜRK", "AYDIN", "ÖZDEMİR",
  "ARSLAN", "DOĞAN", "KILIÇ", "ASLAN", "ÇETİN", "KARADAĞ", "KARA", "KOÇ", "KURT", "ÖZKAN",
  "ŞİMŞEK", "POLAT", "TAŞ", "KESKİN", "GÜNEŞ", "CAN", "TEKİN", "GÜLER", "AKSOY", "KORKMAZ",
  "ERDOĞAN", "BOZKURT", "DUMAN", "TOSUN", "KAPLAN", "ÇAKIR", "ÇAKMAK", "AKAR", "ÜNAL", "ŞEN",
  "DİNÇ", "GÜMÜŞ", "SARI", "DEMİRCİ", "KESER", "DEMİREL", "ALKAN", "DOĞRU", "BULUT", "YAVUZ",
  "TÜRK", "GÖKÇE", "UZUN", "SÖNMEZ", "KÖSE", "GÖKSU", "KAN", "ORHAN", "KAYA", "ERDEM",
  "AKTAŞ", "VURAL", "ATEŞ", "YÜKSEL", "ÇOBAN", "ÖZKAYA", "FIRAT", "ÖCAL", "ELMAS", "GÜNGÖR",
  "BAŞAR", "YALÇIN", "GÜÇLÜ", "DAĞ", "ATA", "ÖZER", "EKİCİ", "BAYRAK", "YAZICI", "KARABULUT",
  "KARAMAN", "DURMUŞ", "ÖZÇELİK", "TUNÇ", "BAYRAM", "İNCE", "KOCABIYIK", "UĞUR", "KILIÇASLAN", "SAVAŞ",
  "OKUR", "GÜVEN", "MERT", "BULUT", "SAYGI", "KARAASLAN", "GÜNDÜZ", "ÖĞÜT", "TAŞKIN", "AKIN"
];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let user_data = {};

mongoose.connect('mongodb+srv://cnerkszz:Cbbmva123@cnerksz.tltz0jc.mongodb.net/onay?retryWrites=true&w=majority&appName=cnerksz').then(() => {
    console.log("MongoDB'ye bağlandı!");
}).catch((err) => {
    console.error("MongoDB bağlantı hatası:", err);
});

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    credit: { type: Number, default: 0 } // Varsayılan kredi
});

const User = mongoose.model('MailUser', userSchema);

// Admin kullanıcılarının Telegram userID'leri
const admins = ['6021356392']; // Admin ID'lerini buraya ekleyin

// Admin kontrol fonksiyonu
function isAdmin(userId) {
    return admins.includes(userId.toString());
}

// Kredi kontrol ve düşürme fonksiyonu
async function checkAndDeductCredits(userId, requiredCredits) {
    let user = await User.findOne({ userId });

    if (!user) {
        user = new User({ userId });
        await user.save();
    }

    if (user.credit >= requiredCredits) {
        user.credit -= requiredCredits;
        await user.save();
        return true; // Kredi yeterli, işlem devam edebilir
    } else {
        return false; // Yetersiz kredi
    }
}

// Kredi ekleme komutu
bot.onText(/\/addcredit (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id.toString();

    if (!isAdmin(senderId)) {
        bot.sendMessage(chatId, 'Bu komutu yalnızca admin kullanıcılar kullanabilir.');
        return;
    }

    const targetUserId = match[1];
    const creditAmount = parseInt(match[2], 10);

    if (isNaN(creditAmount) || creditAmount <= 0) {
        bot.sendMessage(chatId, 'Lütfen geçerli bir kredi miktarı girin.');
        return;
    }

    let user = await User.findOne({ userId: targetUserId });

    if (!user) {
        user = new User({ userId: targetUserId, credit: 0 });
    }

    user.credit += creditAmount;
    await user.save();

    // Admin'e bilgi mesajı
    bot.sendMessage(chatId, `${targetUserId} ID'li kullanıcıya ${creditAmount} kredi eklendi. Toplam kredi: ${user.credit}`);

    // Hedef kullanıcıya bilgi mesajı
    bot.sendMessage(targetUserId, `Hesabınıza ${creditAmount} kredi eklendi. Mevcut krediniz: ${user.credit}`);
});

bot.onText(/\/buy (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString(); // Kullanıcı ID'sini al
    const numberOfAccounts = parseInt(match[1], 10);
    const requiredCredits = numberOfAccounts; // Her bir görev için 1 kredi

    if (isNaN(numberOfAccounts) || numberOfAccounts <= 0) {
        bot.sendMessage(chatId, 'Lütfen geçerli bir görev sayısı girin.');
        return;
    }

    const hasEnoughCredits = await checkAndDeductCredits(userId, requiredCredits);

    if (!hasEnoughCredits) {
        bot.sendMessage(chatId, 'Yetersiz kredi. Lütfen kredilerinizi kontrol edin.');
        return;
    }

  

    for (let i = 0; i < numberOfAccounts; i++) {
         const sentMessage = await bot.sendMessage(chatId, 'Yemeksepeti hesabı oluşturuluyor. Lütfen bekleyin...');
        const email = await newEmail();  // Hesap oluşturma fonksiyonu
        await bot.editMessageText(`Yeni hesap oluşturuldu: <code>${email}</code>`, {
          chat_id: chatId,
          message_id: sentMessage.message_id,
          parse_mode: 'HTML' // parse_mode burada belirtilmeli
      });
    }
});

// Kullanıcı kredi durumu komutu
bot.onText(/\/credit/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    let user = await User.findOne({ userId });

    if (!user) {
        bot.sendMessage(chatId, 'Kredi bilginiz bulunmamaktadır.');
    } else {
        bot.sendMessage(chatId, `Mevcut krediniz: ${user.credit}`);
    }
});

// /start komutu
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id; // Kullanıcı ID'sini al

  const welcomeMessage = `Merhaba! Botumuza hoş geldiniz.
      
Bu botu kullanarak yemeksepeti hesabı oluşturabilir ve bu hesapları kullanırken doğrulama işlemlerinizi yapabilirsiniz. İşte botun kullanımı:
      
/buy 5 komutu ile 5 tane hesap oluşturacaktır. Sayıyı 2 saat içerisinde kullanabileceğiniz miktar ile değiştirebilirsiniz.v

1 hesap yaklaşık 3 dk içinde oluşur.Hesapları ona göre oluşturup kullanabilirsiniz.

Mail üzerine tıkladığınızda kopyalayacaktır. 

/credit ile kalan kredinizi öğrenebilirsiniz.

Doğrulama işlemi için yemeksepetine girecek olduğunuz maili buraya yapıştırın. Yemeksepeti kod isterse bir kaç saniye içerisinde kodu bottan alabilirsiniz.
      
Herhangi bir sorunuz olursa, bizimle iletişime geçebilirsiniz.

Kullanıcı ID'niz: <code>${userId}</code>
  `;
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'html' });
});

bot.onText(/\/id/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id; // Kullanıcı ID'sini al

  const message = `Kullanıcı ID'niz: <code>${userId}</code>`;
  bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});
// Mesajları işleme
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        try {
            const response = await axios.get(`https://api.kopeechka.store/mailbox-reorder?site=yemeksepeti.com&email=${text}&token=${mailrutoken}&password=0&subject=&regex=&type=json&api=2.0`);
            const id = response.data.id;
            user_data[chatId] = { email_id: id };
            bot.sendMessage(chatId, "Emailiniz alındı. Onay kodu aranıyor, lütfen bekleyin...");

            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 saniye bekleme

            await getCode(chatId);

        } catch (error) {
            bot.sendMessage(chatId, 'Email hesabına bağlanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        }
    }
});

// Onay kodu alma fonksiyonu
async function getCode(chatId) {
    const email_id = user_data[chatId]?.email_id;

    if (!email_id) {
        bot.sendMessage(chatId, 'Önce geçerli bir e-posta adresi girin.');
        return;
    }

    let foundCode = false;
    for (let i = 0; i < 45; i++) { // 2 dakika boyunca her 2 saniyede bir kontrol edecek
        try {
            const response = await axios.get(`https://api.kopeechka.store/mailbox-get-message?id=${email_id}&token=${mailrutoken}&full=0&type=json&api=2.0`);
            const htmlString = response.data.fullmessage || '';

            const $ = cheerio.load(htmlString);
            const textElements = $('td').text();

            const match = textElements.match(/\b\d{4}\b/);
            if (match) {
                const code = match[0];
                await bot.sendMessage(chatId, `Onay Kodu: ${code}`);
                await bot.sendMessage(chatId, 'Onay kodu kopyalandı!', {reply_markup: {keyboard: [['Kod Kopyala']], resize_keyboard: true}});
                foundCode = true;
                break;
            }

        } catch (error) {
            bot.sendMessage(chatId, 'Kod alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekleme
    }

    if (!foundCode) {
        bot.sendMessage(chatId, 'Onay Kodu bulunamadı.');
    }
}

// Görev oluşturma fonksiyonu
async function newEmail() {
    console.log("newEmail fonksiyonu çağrıldı"); 
  let browser; //
    try {
        const proxy = proxyList[0].split(":"); // İlk proxyyi kullan
        const [host, port, username, password] = proxy;
        puppeteer.use(
          RecaptchaPlugin({
            provider: {
              id: '2captcha',
              token: '715d54c5889aad128738b1b49e634b7a' // 2CAPTCHA API KEYİNİZİ BURAYA EKLEYİN ⚡
            },
            visualFeedback: true // colorize reCAPTCHAs (violet = detected, green = solved)
          })
        )
        puppeteer.use(pluginProxy({
            address: host,
            port: port,
            credentials: {
                username: username,
                password: password,
            }
        }));

       browser = await puppeteer.launch({
        
            headless: true,
            slowMo: 40,
            args: ['--start-maximized', "--incognito",
                '--no-sandbox',
                '--disable-setuid-sandbox'
        ],
        });

        let [page] = await browser.pages();
        await page.authenticate({ username, password });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.80 Safari/537.36');
        await page.goto("https://www.yemeksepeti.com", { waitUntil: 'networkidle2' });

        const hasRecaptcha = await page.$('.g-recaptcha') !== null;

        if (hasRecaptcha) {
            await page.solveRecaptchas();
            await page.waitForNavigation();
        }
        console.log("açtım")
        try {
 
            await page.waitForSelector('text=Hepsini Kabul Et', { visible: true, timeout: 5000 });
            await page.click('text=Hepsini Kabul Et');
        } catch (error) {
        }

        await page.waitForSelector('text=Kayıt Ol', { visible: true, timeout: 60000 });
        await page.click('text=Kayıt Ol');

        await page.waitForSelector('[data-testid="welcome-view-button-signup"]');
        await page.click('[data-testid="welcome-view-button-signup"]');

        const { data } = await axios.get(`https://api.kopeechka.store/mailbox-get-email?site=yemeksepeti.com&mail_type=hotmail.com&token=${mailrutoken}&password=0&regex=&subject=&investor=&soft=&type=json&api=2.0`);
        const mail = data.mail;
        const mailId = data.id;
        console.log("geldim bura kadar")
        await page.waitForSelector('[data-testid="email-view-text-field"]');
        await page.focus('[data-testid="email-view-text-field"]');
        await page.keyboard.type(mail);

        await page.waitForSelector('[data-testid="email-view-continue-button"]');
        await page.click('[data-testid="email-view-continue-button"]');

        await page.waitForSelector('[data-testid="email-verify-button"]', { timeout: 3000 });
        await page.click('[data-testid="email-verify-button"]');

        const hrefValue = await checkForLink(mailId,browser);
        await gotoWithRetry(page, hrefValue);
        await gotoWithRetry(page, hrefValue);

        const { randomName, randomSurname } = randomNameAndSurname();

     
    await page.waitForSelector('[data-testid="registration-view-field-first-name"]');
    await page.type('[data-testid="registration-view-field-first-name"]', randomName);

    await page.waitForSelector('[data-testid="registration-view-field-last-name"]');
    await page.click('[data-testid="registration-view-field-last-name"]');
    await page.type('[data-testid="registration-view-field-last-name"]', randomSurname);
    await page.waitForSelector('[data-testid="registration-view-field-birthdate"]');
    await page.click('[data-testid="registration-view-field-birthdate"]');

        console.log("olmak üzere")
        await page.waitForSelector('.bds-c-checkbox__icon');
        await page.click('.bds-c-checkbox__icon');

        await page.waitForSelector('[data-testid="registration-view-field-password"]');
        await page.focus('[data-testid="registration-view-field-password"]');
        await page.keyboard.type('Turkiyem123..');

        await page.waitForSelector('[data-testid="registration-view-continue-button"]');
        await page.click('[data-testid="registration-view-continue-button"]');
        await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await page.waitForSelector('[data-testid="registration-view-continue-button"]',{timeout:2000});
      await page.click('[data-testid="registration-view-continue-button"]');
    
    } catch (error) {
      
    }

        await page.waitForSelector('text=Aşağıdaki hükümlerin tamamını kabul ediyorum', { timeout: 5000 });
        await page.click('text=Aşağıdaki hükümlerin tamamını kabul ediyorum');

        await page.waitForSelector('text=Devam Et');
        await page.click('text=Devam Et');
        await new Promise(resolve => setTimeout(resolve, 3000));


        await browser.close();

        return mail; // E-posta adresini döndür

    } catch (error) {
        console.log("hata")
      await browser.close();


      return await newEmail();
    }
}

// Yardımcı Fonksiyonlar
async function checkForLink(mailId,browser) {
    return new Promise(async (resolve, reject) => {
        let interval;
        const timeout = setTimeout(async () => {
            clearInterval(interval);
            await axios.get(`https://api.kopeechka.store/mailbox-cancel?id=${mailId}&token=${mailrutoken}&type=$TYPE&api=2.0`);
            await browser.close();
      return await newEmail();

        }, 100000);

        try {
            interval = setInterval(async () => {
                const res = await axios.get(`https://api.kopeechka.store/mailbox-get-message?id=${mailId}&token=${mailrutoken}&full=0&type=json&api=2.0`);
                const htmlString = res.data.fullmessage || '';

                const $ = cheerio.load(htmlString);
                const linkElement = $('a[href*="yemeksepeti.page.link"]').attr('href');

                if (linkElement) {
                    clearInterval(interval);
                    clearTimeout(timeout);
                    resolve(linkElement);
                }
            }, 5000);
        } catch (error) {
            clearInterval(interval);
            clearTimeout(timeout);
            reject(error);
        }
    });
}

async function gotoWithRetry(page, hrefValue, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await page.evaluate((href) => {
                window.location.href = href;
            }, hrefValue);
            await page.waitForNavigation({ waitUntil: 'load', timeout: 0 });
            return;
        } catch (error) {}
    }
}

function randomNameAndSurname() {
    const randomName = chance.pickone(turkishNames);
    const randomSurname = chance.pickone(turkishSurnames);
    return { randomName, randomSurname };
}

function randomDate(start, end) {
    const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    const day = ("0" + randomDate.getDate()).slice(-2);
    const month = ("0" + (randomDate.getMonth() + 1)).slice(-2);
    const year = randomDate.getFullYear();
    return `${day}.${month}.${year}`;
}

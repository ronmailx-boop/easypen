// Voice-over for the promo video: what the narrator says over each screen (the intro card, the
// five steps and the outro card), per language, and the Google Cloud Text-to-Speech voice.
// Run `node scripts/promo-voice.js [he|en|ru]` to (re)make scripts/voice/<lang>-<n>.mp3; the video
// script picks them up when they are there. Needs the API key in GOOGLE_TTS_API_KEY (an
// environment variable, never in the code), unless the network adds it to the request.
const fs = require('fs');
const path = require('path');

const VOICE = {
  he: {
    languageCode: 'he-IL', voices: ['he-IL-Chirp3-HD-Charon', 'he-IL-Wavenet-B', 'he-IL-Standard-B'],
    lines: ['איזי פֶּן. חותמים על מסמכים, ישר מהטלפון.', 'מעלים פי די אף, או תמונה.', 'חותמים באצבע.', 'ממלאים פרטים.',
      'מסמנים וי.', 'שומרים, ושולחים.', 'בחינם, בלי הרשמה. הקבצים לא עוזבים את המכשיר.']
  },
  en: {
    languageCode: 'en-US', voices: ['en-US-Chirp3-HD-Charon', 'en-US-Neural2-D', 'en-US-Wavenet-D'],
    lines: ['EasyPen. Sign documents, right on your phone.', 'Upload a PDF or a photo.', 'Sign with your finger.', 'Fill in your details.',
      'Tick the box.', 'Save, and send.', 'Free, no sign-up. Your files never leave your device.']
  },
  ru: {
    languageCode: 'ru-RU', voices: ['ru-RU-Chirp3-HD-Charon', 'ru-RU-Wavenet-D', 'ru-RU-Standard-D'],
    lines: ['Изи Пен. Подписывайте документы прямо в телефоне.', 'Загрузите пэ-дэ-эф или фото.', 'Подпишите пальцем.', 'Заполните данные.',
      'Поставьте галочку.', 'Сохраните и отправьте.', 'Бесплатно, без регистрации. Файлы не покидают устройство.']
  }
};
const DIR = process.env.PROMO_VOICE_DIR || path.join(__dirname, 'voice');

// The clips for a language, or null when they are missing or were made from other lines
function clips(lang) {
  const meta = path.join(DIR, `${lang}.json`);
  if (!fs.existsSync(meta)) return null;
  const made = JSON.parse(fs.readFileSync(meta, 'utf8'));
  if (JSON.stringify(made.lines) !== JSON.stringify(VOICE[lang].lines)) return null;
  return made.lines.map((_, i) => path.join(DIR, `${lang}-${i}.mp3`));
}

async function tts(endpoint, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.GOOGLE_TTS_API_KEY) headers['X-Goog-Api-Key'] = process.env.GOOGLE_TTS_API_KEY;
  const res = await fetch(`https://texttospeech.googleapis.com/v1/${endpoint}`, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  if (!res.ok) throw new Error(`Text-to-Speech ${endpoint}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function make(lang) {
  const v = VOICE[lang];
  const available = new Set((await tts(`voices?languageCode=${v.languageCode}`)).voices.map((x) => x.name));
  const name = v.voices.find((n) => available.has(n));
  if (!name) throw new Error(`None of ${v.voices.join(', ')} is available`);
  fs.mkdirSync(DIR, { recursive: true });
  for (const [i, text] of v.lines.entries()) {
    const { audioContent } = await tts('text:synthesize', {
      input: { text }, voice: { languageCode: v.languageCode, name }, audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 44100 }
    });
    fs.writeFileSync(path.join(DIR, `${lang}-${i}.mp3`), Buffer.from(audioContent, 'base64'));
  }
  fs.writeFileSync(path.join(DIR, `${lang}.json`), JSON.stringify({ voice: name, lines: v.lines }, null, 2) + '\n');
  console.log(lang, name, v.lines.length, 'clips');
}

module.exports = { clips };

if (require.main === module) {
  (async () => { for (const lang of process.argv[2] ? [process.argv[2]] : Object.keys(VOICE)) await make(lang); })()
    .catch((e) => { console.error(e.message); process.exit(1); });
}

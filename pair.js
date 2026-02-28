const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  if (!num) return res.send({ error: "Number is required" });

  async function RobinPair() {
    // සැමවිටම අලුත් සැසියක් ආරම්භ කිරීමට පැරණි ඒවා මකා දමන්න
    removeFile("./session");
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);

    try {
      let RobinPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        // මෙහි Browser එක Chrome ලෙස වෙනස් කිරීම වඩාත් හොඳයි
        browser: ["Ubuntu", "Chrome", "20.0.04"],
      });

      if (!RobinPairWeb.authState.creds.registered) {
        // ඉතා වැදගත්: මෙහි Delay එක තත්පර 5ක් දක්වා වැඩි කර ඇත
        await delay(5000); 
        num = num.replace(/[^0-9]/g, "");
        const code = await RobinPairWeb.requestPairingCode(num);
        
        if (!res.headersSent) {
          await res.send({ code });
        }
      }

      RobinPairWeb.ev.on("creds.update", saveCreds);
      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            await delay(10000);
            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);

            // Mega Upload Logic
            const mega_url = await upload(
              fs.createReadStream("./session/creds.json"),
              `${Math.random().toString(36).substring(2, 10)}.json`
            );

            const string_session = mega_url.replace("https://mega.nz/file/", "");

            const sid = `*🤖 𝐖𝙴𝙻𝙲𝙾𝙼𝙴 𝐓𝙾 𝐍𝙴𝚃𝙷𝙼𝙸𝙽𝙰 𝐎ƒᴄ 𝐖𝙰 𝐁𝙾𝚃 🤖*\n\n*🆔 ${string_session} 🆔*\n\n*👆 This is your Session ID, copy this id and paste into config.js file*`;
            
            await RobinPairWeb.sendMessage(user_jid, {
              image: { url: "https://i.ibb.co/d09vGfs6/jpg.jpg" },
              caption: sid,
            });

            await delay(2000);
            // Session එක එවූ පසු පමණක් session folder එක මකන්න
            removeFile("./session");
            process.exit(0);

          } catch (e) {
            console.log(e);
            exec("pm2 restart all");
          }
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          await delay(5000);
          RobinPair();
        }
      });
    } catch (err) {
      console.log("Error in RobinPair:", err);
      if (!res.headersSent) {
        await res.send({ code: "Service Unavailable" });
      }
    }
  }
  return await RobinPair();
});

module.exports = router;

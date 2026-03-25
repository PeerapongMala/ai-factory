import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

// 1. Get Authentication & Configure Paths
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.error(JSON.stringify({ status: "FAILED", role: "Executor(Audio)", error: "Missing ELEVENLABS_API_KEY in environment variable." }, null, 2));
  process.exit(1);
}

const AUDIO_DIR = join(__dirname, "../assets/audio");
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

// Energetic / Young Gamer Voice ID for high-hype delivery
const VOICE_ID = "TxGEqnHWrfWFTfGW9XjX"; 

async function run() {
  try {
    // 2. Read JSON Input (from process_content.ts output)
    let inputStr = "";
    if (process.argv.length > 2) {
      inputStr = readFileSync(process.argv[2], "utf8");
    } else {
      inputStr = await Bun.stdin.text();
    }

    if (!inputStr.trim()) {
      throw new Error("No input data received. Provide a JSON file or pipe data.");
    }

    const inputData = JSON.parse(inputStr);

    if (inputData.status === "FAILED" || !inputData.data || inputData.data.length === 0) {
       console.log(JSON.stringify({ 
         status: "SKIPPED", 
         role: "Executor(Audio)", 
         msg: "No valid generated scripts to process." 
       }, null, 2));
       return;
    }

    const results = [];

    // 3. Process each AI Script
    for (let i = 0; i < inputData.data.length; i++) {
        const item = inputData.data[i];
        const scriptJson = item.generated_script;
        
        // Extract Reel Script for voiceover
        const reel = scriptJson.reel_script || scriptJson;
        // Ensure graceful concatenation of hook, body, and CTA
        const fullScript = [reel.hook, reel.body, reel.cta]
                              .filter(Boolean)
                              .join(" ");

        if (!fullScript) {
            results.push(item);
            continue;
        }

        // Send to ElevenLabs API
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: fullScript,
                model_id: "eleven_multilingual_v2", // Optimized natively for Thai language
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`ElevenLabs API Error [${response.status}]: ${err}`);
        }

        // Standardize output buffers
        const audioBuffer = await response.arrayBuffer();
        const fileName = `voice_script_${Date.now()}_${i}.mp3`;
        const filePath = join(AUDIO_DIR, fileName);
        
        // 4. Save Audio file to Local Disk
        writeFileSync(filePath, Buffer.from(audioBuffer));

        // Pass along the audio context to the next phase (Pexels fetcher / Creatomate Renderer)
        results.push({
            ...item,
            audio: {
                local_path: filePath,
                filename: fileName
            }
        });
    }

    // 5. Output finalized context
    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Executor(Audio)",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Executor(Audio)",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();

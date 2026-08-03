const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const destDir = 'C:\\Users\\user\\Desktop\\보내는 용도';
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
        // Handle AWS S3 redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            https.get(response.headers.location, redirectResponse => {
                redirectResponse.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            }).on('error', err => reject(err));
        } else {
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }
    }).on('error', err => reject(err));
  });
}

async function build(profile, filename) {
  console.log(`\n🚀 Starting EAS Build for [${profile}]... (This takes 10-20 minutes)`);
  try {
    const output = execSync(`npx eas build --profile ${profile} --platform android --non-interactive --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 1024 * 1024 * 50 });
    
    // Attempt to parse the JSON array from EAS output
    const match = output.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
        const result = JSON.parse(match[0]);
        const url = result[0]?.artifacts?.buildUrl;
        if (url) {
            console.log(`🎉 Build FINISHED! Downloading APK from ${url}...`);
            await download(url, path.join(destDir, filename));
            console.log(`💾 Download complete: ${filename} saved to Desktop!`);
            return;
        }
    }
    console.log(`Failed to parse URL. Raw output preview:`, output.substring(0, 500));
  } catch (err) {
    console.error(`Build failed for ${profile}. Error:`, err.message);
    if (err.stdout) console.log(err.stdout.toString().substring(0, 1000));
  }
}

async function main() {
  console.log('Initiating EAS Cloud Builds for DEMO and PROD...');
  await build('preview-demo', 'Anyway_the_Sea_DEMO.apk');
  await build('preview-prod', 'Anyway_the_Sea_PROD.apk');
  console.log('\n✅ All EAS builds and downloads complete! Check your desktop folder.');
}

main();

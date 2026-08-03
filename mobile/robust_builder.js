const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const destDir = 'C:\\Users\\user\\Desktop\\보내는 용도';
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
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

function runEasBuild(profile) {
    return new Promise((resolve, reject) => {
        let stdoutData = '';
        let stderrData = '';
        console.log(`\n================================`);
        console.log(`🚀 Launching EAS Build for ${profile} (This blocks for 15-20 mins)...`);
        console.log(`================================\n`);
        
        const child = spawn('npx.cmd', ['eas', 'build', '--profile', profile, '--platform', 'android', '--non-interactive', '--wait', '--json'], { shell: true });
        
        child.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderrData += data.toString();
            process.stdout.write(data);
        });
        
        child.on('close', (code) => {
            const match = stdoutData.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                try {
                    const result = JSON.parse(match[0]);
                    const url = result[0]?.artifacts?.buildUrl;
                    if (url) {
                        resolve(url);
                        return;
                    }
                } catch(e) { /* ignore JSON parse error */ }
            }
            if (code !== 0) {
                reject(new Error(`Exit code ${code}. Stderr: ${stderrData.substring(0, 1000)}`));
            } else {
                reject(new Error(`Could not parse JSON. Stdout: ${stdoutData.substring(0, 500)}`));
            }
        });
    });
}

async function main() {
    try {
        const demoUrl = await runEasBuild('preview-demo');
        console.log(`\n🎉 [DEMO] Build finished! Downloading APK...`);
        await download(demoUrl, path.join(destDir, 'Anyway_the_Sea_DEMO.apk'));
        console.log('✅ [DEMO] Download saved to Desktop!');
        
        const prodUrl = await runEasBuild('preview-prod');
        console.log(`\n🎉 [PROD] Build finished! Downloading APK...`);
        await download(prodUrl, path.join(destDir, 'Anyway_the_Sea_PROD.apk'));
        console.log('✅ [PROD] Download saved to Desktop!');
        
        console.log('\n🌟 ALL EAS BUILDS AND DOWNLOADS COMPLETED SUCCESSFULLY!');
    } catch(e) {
        console.error('\n❌ Build process failed:', e.message);
    }
}
main();

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const express = require('express');
const dotenv = require('dotenv');
const cron = require('node-cron');
const { FOLDER_PROJECT } = require('./folder');
const axios = require("axios");

dotenv.config()

const app = express();

const OWNER = process.env.REPO_OWNER;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO_NAME;
const BRANCH = process.env.BRANCH;
const LAST_COMMIT_FILE = "./last_commit_sha.txt";

async function getLatestCommitSha() {
  const res = await axios.get(
    `https://api.github.com/repos/${OWNER}/${REPO}/commits?sha=${BRANCH}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  return res.data[0].sha;
}

function deployFolders(folderList) {
  folderList.forEach((folder) => {
    const folderPath = path.join(folder);
    console.log(`⬇ Pulling & building ${folderPath}`);
    try {
      execSync(`git pull`, { cwd: folderPath, stdio: "inherit" });
      execSync(`npm install`, { cwd: folderPath, stdio: "inherit" });
      execSync(`npm run build`, { cwd: folderPath, stdio: "inherit" });
      execSync(`pm2 restart ${folder}`, { stdio: "inherit" });
      console.log(`✅ ${folder} selesai`);
    } catch (err) {
      console.error(`❌ Gagal deploy ${folder}:`, err.message);
    }
  });
}

async function checkAndUpdate() {
    const latestSha = await getLatestCommitSha();

    let lastSha = "";
    if (fs.existsSync(LAST_COMMIT_FILE)) {
        lastSha = fs.readFileSync(LAST_COMMIT_FILE, "utf8");
    }

    if (latestSha !== lastSha) {
        console.log("🚀 Terdapat commit baru, menjalankan deploy...");
        fs.writeFileSync(LAST_COMMIT_FILE, latestSha);

        deployFolders(FOLDER_PROJECT);
    } else {
        console.log("✅ Tidak ada update commit. Tidak ada tindakan.");
    }
}

cron.schedule(process.env.CRON_SCHEDULE, () => {
    checkAndUpdate()
})

app.get('/', (req, res) => {
    res.send("Auto Update Is Running");
});

app.listen(process.env.PORT, () => {
    console.log(`Server is Running On Port ${process.env.PORT}`);
})
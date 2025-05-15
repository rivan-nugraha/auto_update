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
const REPO_FE = process.env.REPO_FE_NAME;
const BRANCH = process.env.BRANCH;
const BRANCH_FE = process.env.BRANCH_FE
const LAST_COMMIT_FILE = "./last_commit_sha.txt";
const LAST_COMMIT_FILE_FE = "./last_commit_sha_fe.txt";

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

async function getLatestCommitFESha() {
  const res = await axios.get(
    `https://api.github.com/repos/${OWNER}/${REPO_FE}/commits?sha=${BRANCH_FE}`,
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
    const folderPath = path.join(folder.be);
    const splitted = folder.be.split("/");
    console.log(splitted.length);
    const folderName = splitted[splitted.length - 1];

    console.log(`⬇ Pulling & building ${folderPath}`);
    try {
      execSync(`git pull`, { cwd: folderPath, stdio: "inherit" });
      execSync(`npm install`, { cwd: folderPath, stdio: "inherit" });
      execSync(`npm run build`, { cwd: folderPath, stdio: "inherit" });
      execSync(`pm2 restart ${folderName}`, { stdio: "inherit" });
      console.log(`✅ ${folderName} selesai`);
    } catch (err) {
      console.error(`❌ Gagal deploy ${folderName}:`, err.message);
    }
  });
}

function deployFoldersFE(folderList) {
  folderList.forEach((folder) => {
    const folderPath = path.join(folder.fe);
    const splitted = folder.fe.split("/");
    const folderName = splitted[splitted.length - 1];

    console.log(`⬇ Pulling & building ${folderPath}`);
    try {
      execSync(`git pull`, { cwd: folderPath, stdio: "inherit" });
      console.log(`✅ ${folderName} selesai`);
    } catch (err) {
      console.error(`❌ Gagal deploy ${folderName}:`, err.message);
    }
  })
}

async function checkAndUpdate() {
    const latestSha = await getLatestCommitSha();
    const latestShaFe = await getLatestCommitFESha();

    let lastSha = "";
    let lastShaFe = "";
    if (fs.existsSync(LAST_COMMIT_FILE)) {
        lastSha = fs.readFileSync(LAST_COMMIT_FILE, "utf8");
    }

    if (fs.existsSync(LAST_COMMIT_FILE_FE)) {
      lastShaFe = fs.readFileSync(LAST_COMMIT_FILE_FE, "utf-8");
    }

    if (latestSha !== lastSha) {
      console.log("🚀 Terdapat commit baru di server side, menjalankan deploy...");
      fs.writeFileSync(LAST_COMMIT_FILE, latestSha);

      deployFolders(FOLDER_PROJECT);
    } else {
      console.log("✅ Tidak ada update commit di server side. Tidak ada tindakan.");
    }

    if (latestShaFe !== lastShaFe) {
      console.log("🚀 Terdapat commit baru di client side, menjalankan deploy...");
      fs.writeFileSync(LAST_COMMIT_FILE_FE, latestShaFe);
      deployFoldersFE(FOLDER_PROJECT);
    } else {
      console.log("✅ Tidak ada update commit di client side. Tidak ada tindakan.");
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
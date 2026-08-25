const fs = require("node:fs");
const path = require("node:path");
const { seedState } = require("../src/seed");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "public");
const target = path.join(root, "docs");

if (!target.startsWith(`${root}${path.sep}`)) {
  throw new Error("배포 대상 경로가 프로젝트 밖을 가리킵니다.");
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
fs.writeFileSync(path.join(target, "seed.json"), JSON.stringify(seedState, null, 2), "utf8");
fs.writeFileSync(path.join(target, ".nojekyll"), "", "utf8");
fs.copyFileSync(path.join(target, "index.html"), path.join(target, "404.html"));

console.log(`GitHub Pages build created: ${target}`);

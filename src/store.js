const fs = require("node:fs");
const path = require("node:path");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class MemoryStore {
  constructor(seed) {
    this.seed = clone(seed);
    this.state = clone(seed);
  }

  read() {
    return clone(this.state);
  }

  write(next) {
    this.state = clone(next);
    return this.read();
  }

  reset() {
    this.state = clone(this.seed);
    return this.read();
  }
}

class FileStore extends MemoryStore {
  constructor(filePath, seed) {
    super(seed);
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      try {
        this.state = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch {
        this.persist();
      }
    } else {
      this.persist();
    }
  }

  persist() {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), "utf8");
    fs.renameSync(tempPath, this.filePath);
  }

  write(next) {
    const result = super.write(next);
    this.persist();
    return result;
  }

  reset() {
    const result = super.reset();
    this.persist();
    return result;
  }
}

module.exports = { MemoryStore, FileStore, clone };

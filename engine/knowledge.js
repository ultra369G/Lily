const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class KnowledgeEngine {
  constructor() {
    // Initialize core data structures
    this.knowledgeBase = new Map();
    this.commands = new Map();
    
    // File system configuration
    this.knowledgeFile = path.join(__dirname, '../knowledge.log');
    this.backupDir = path.join(__dirname, '../backups');
    this.archiveDir = path.join(__dirname, '../archive');
    
    // Ensure directories exist
    [this.backupDir, this.archiveDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Initialize all systems
    this.setupCommands();
    this.loadPersistentKnowledge();
    this.setupAutoSave();
    this.setupSelfHealing();
  }

  // ======================
  // AUTO-SAVE SYSTEM
  // ======================

  setupAutoSave() {
    // Save every 5 minutes
    this.autoSaveInterval = setInterval(() => {
      this.saveKnowledge();
    }, 5 * 60 * 1000);
    
    // Ensure cleanup on exit
    process.on('exit', () => {
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
      }
      this.saveKnowledge();
    });
  }

  // ======================
  // CORE KNOWLEDGE METHODS
  // ======================

  addKnowledge({ question, answer, tags = [], lastUsed = Date.now(), usageCount = 0 }) {
    const key = this.normalizeKey(question);
    const entry = {
      question,
      answer,
      tags: [...new Set(tags)],
      lastUsed,
      usageCount,
      hash: this.createHash(question + answer),
      source: 'user'
    };
    
    this.knowledgeBase.set(key, entry);
    return entry;
  }

  forgetKnowledge(question) {
    const key = this.normalizeKey(question);
    const existed = this.knowledgeBase.delete(key);
    return existed ? `Forgot: ${question}` : `No knowledge found for: ${question}`;
  }

  processQuery(query, learn = true) {
    // Check for commands first
    if (query.startsWith('!')) {
      return this.processCommand(query.slice(1).trim());
    }

    const normalized = this.normalizeKey(query);
    let response;

    // 1. Exact match
    if (this.knowledgeBase.has(normalized)) {
      response = this.knowledgeBase.get(normalized);
      response.confidence = 1.0;
    }
    // 2. Similar questions
    else {
      response = this.findSimilar(normalized);
    }

    // 3. Learning system
    if (learn && (!response || response.confidence < 0.7)) {
      response = {
        answer: this.generateLearningPrompt(query),
        confidence: 0.3,
        needsTraining: true,
        originalQuery: query
      };
    }

    // Update usage stats
    if (response?.question) {
      const record = this.knowledgeBase.get(this.normalizeKey(response.question));
      if (record) {
        record.usageCount++;
        record.lastUsed = Date.now();
      }
    }

    return response || { 
      answer: "I need training for this query.", 
      confidence: 0,
      originalQuery: query 
    };
  }

  // ======================
  // COMMAND SYSTEM
  // ======================

  setupCommands() {
    // System commands
    this.addCommand({
      trigger: "help",
      response: [
        "⚙ SYSTEM COMMANDS:",
        "!help - Show this help",
        "!reset - Reset knowledge base",
        "!backup - Create backup",
        "!stats - Show statistics",
        "!export - Export knowledge",
        "",
        "📚 KNOWLEDGE COMMANDS:",
        "learn: [question] => [answer] - Add knowledge",
        "forget: [question] - Remove knowledge",
        "list - Show knowledge summary"
      ].join('\n'),
      tags: ["system"]
    });

    this.addCommand({
      trigger: "backup",
      action: () => this.createBackup(),
      tags: ["system"]
    });

    this.addCommand({
      trigger: "reset",
      response: "⚠ Type '!confirm reset' to wipe all knowledge",
      tags: ["system", "dangerous"]
    });

    this.addCommand({
      trigger: "confirm reset",
      action: () => {
        this.knowledgeBase.clear();
        this.saveKnowledge();
        return "✅ All knowledge has been reset";
      },
      tags: ["system"]
    });

    this.addCommand({
      trigger: "stats",
      action: () => {
        const now = Date.now();
        const stats = {
          total: this.knowledgeBase.size,
          active: Array.from(this.knowledgeBase.values())
                    .filter(k => (now - k.lastUsed) < 30 * 24 * 60 * 60 * 1000).length,
          byTag: {}
        };

        this.knowledgeBase.forEach(entry => {
          entry.tags?.forEach(tag => {
            stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
          });
        });
        return [
            `📊 KNOWLEDGE STATS:`,
            `• Total entries: ${stats.total}`,
            `• Active (last 30 days): ${stats.active}`,
            `• By category:`,
            ...Object.entries(stats.byTag).map(([tag, count]) => `  - ${tag}: ${count}`)
          ].join('\n');
        },
        tags: ["system"]
      });

    this.addCommand({
      trigger: "export",
      action: () => {
        const exportFile = path.join(this.archiveDir, `knowledge_export_${Date.now()}.json`);
        const data = JSON.stringify(this.getKnowledge(), null, 2);
        fs.writeFileSync(exportFile, data);
        return `✅ Exported to ${exportFile}`;
      },
      tags: ["system"]
    });

    this.addCommand({
      trigger: "list",
      action: () => {
        const entries = Array.from(this.knowledgeBase.values())
          .slice(0, 10)
          .map(e => `• ${e.question} => ${e.answer.substring(0, 50)}...`);
        return `📋 Recent Knowledge (${this.knowledgeBase.size} total):\n${entries.join('\n')}`;
      },
      tags: ["system"]
    });
  }

  addCommand({ trigger, response, action, tags = [] }) {
    this.commands.set(this.normalizeKey(trigger), {
      trigger,
      response,
      action: action ? action.bind(this) : null,
      tags
    });
  }

  processCommand(command) {
    const [cmd, ...args] = command.split(' ');
    const normalized = this.normalizeKey(cmd);
    const handler = this.commands.get(normalized);

    if (!handler) {
      return {
        answer: "❌ Unknown command. Type !help for available commands.",
        confidence: 0,
        isCommand: true
      };
    }

    try {
      const result = handler.action 
        ? handler.action(args) 
        : handler.response;
      
      return {
        answer: typeof result === 'string' ? result : JSON.stringify(result),
        confidence: 1,
        isCommand: true
      };
    } catch (error) {
      return {
        answer: `⚠ Command failed: ${error.message}`,
        confidence: 0,
        isCommand: true
      };
    }
  }

  // ======================
  // PERSISTENCE & BACKUPS
  // ======================

  loadPersistentKnowledge() {
    try {
      if (fs.existsSync(this.knowledgeFile)) {
        const data = fs.readFileSync(this.knowledgeFile, 'utf-8');
        let loaded = 0;

        data.split('\n').forEach(line => {
          if (line.trim() && !line.startsWith('#')) {
            const [timestamp, question, answer, usageCount, tags] = line.split('|');
            if (question && answer) {
              this.addKnowledge({
                question,
                answer,
                lastUsed: parseInt(timestamp, 10) || Date.now(),
                usageCount: parseInt(usageCount, 10) || 0,
                tags: tags ? tags.split(',') : []
              });
              loaded++;
            }
          }
        });
        console.log(`📦 Loaded ${loaded} knowledge entries`);
      }
    } catch (error) {
      console.error("🚨 Knowledge load error:", error);
    }
  }

  saveKnowledge() {
    const entries = [];
    this.knowledgeBase.forEach(entry => {
      entries.push([
        entry.lastUsed,
        entry.question,
        entry.answer,
        entry.usageCount,
        entry.tags?.join(',')
      ].join('|'));
    });

    try {
      const tmpFile = `${this.knowledgeFile}.tmp`;
      fs.writeFileSync(
        tmpFile, 
        "# AI Nexus Knowledge Base\n" +
        "# Format: timestamp|question|answer|usageCount|tags\n" +
        entries.join('\n')
      );
      
      fs.renameSync(tmpFile, this.knowledgeFile);
      console.log(`💾 Saved ${entries.length} knowledge entries`);
    } catch (error) {
      console.error("🚨 Knowledge save failed:", error);
    }
  }

  createBackup() {
    try {
      const timestamp = Date.now();
      const backupFile = path.join(this.backupDir, `knowledge.${timestamp}.log`);
      fs.copyFileSync(this.knowledgeFile, backupFile);
      
      // Rotate backups (keep last 7)
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('knowledge.') && f.endsWith('.log'))
        .sort()
        .reverse();
      
      if (backups.length > 7) {
        backups.slice(7).forEach(f => {
          fs.unlinkSync(path.join(this.backupDir, f));
        });
      }
      
      return `✅ Backup created: ${backupFile}`;
    } catch (error) {
      return `❌ Backup failed: ${error.message}`;
    }
  }

  // ======================
  // SELF-HEALING SYSTEMS
  // ======================

  setupSelfHealing() {
    // Daily maintenance
    setInterval(() => {
      this.cleanCorruptedEntries();
      this.flagConflictingKnowledge();
      this.pruneUnusedKnowledge(90); // 90 days
    }, 24 * 60 * 60 * 1000);
  }

  cleanCorruptedEntries() {
    let cleaned = 0;
    this.knowledgeBase.forEach((value, key) => {
      if (!value.question || !value.answer) {
        this.knowledgeBase.delete(key);
        cleaned++;
      }
    });
    if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} corrupted entries`);
  }

  flagConflictingKnowledge() {
    const hashMap = new Map();
    let conflicts = 0;
    
    this.knowledgeBase.forEach(entry => {
      if (hashMap.has(entry.hash)) {
        entry.tags = [...(entry.tags || []), 'conflict'];
        conflicts++;
      } else {
        hashMap.set(entry.hash, true);
      }
    });
    
    if (conflicts > 0) console.log(`⚠ Flagged ${conflicts} knowledge conflicts`);
  }

  pruneUnusedKnowledge(days = 90) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    let pruned = 0;
    
    this.knowledgeBase.forEach((value, key) => {
      if (value.lastUsed < cutoff && !value.tags.includes('keep')) {
        this.knowledgeBase.delete(key);
        pruned++;
      }
    });
    
    if (pruned > 0) console.log(`✂ Pruned ${pruned} unused entries (older than ${days} days)`);
  }

  // ======================
  // UTILITY METHODS
  // ======================

  findSimilar(query) {
    let bestMatch = null;
    let highestScore = 0;

    this.knowledgeBase.forEach((entry, key) => {
      const score = this.calculateSimilarity(query, key);
      if (score > highestScore && score > 0.6) {
        highestScore = score;
        bestMatch = { 
          ...entry, 
          confidence: score 
        };
      }
    });

    return bestMatch;
  }

  calculateSimilarity(a, b) {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    return intersection.size / (wordsA.size + wordsB.size - intersection.size);
  }

  normalizeKey(text) {
    return text.toLowerCase()
              .replace(/[^\w\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
  }

  createHash(content) {
    return crypto.createHash('sha256')
                .update(content)
                .digest('hex')
                .substring(0, 12); // Shorten for efficiency
  }

  generateLearningPrompt(query) {
    return [
      `🤔 I need training for: "${query}"`,
      `Please respond with:`,
      `learn: ${query} => [correct answer]`,
      `Or use the training panel to teach me.`
    ].join('\n');
  }

  getKnowledge() {
    return Array.from(this.knowledgeBase.values());
  }
}

module.exports = KnowledgeEngine;
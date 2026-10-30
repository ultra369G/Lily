# 🟢 AI Nexus

**AI Nexus** is a lightweight, self-contained, Node.js-powered knowledge engine and real-time conversational server. It features a custom modular knowledge base, automated persistence, auto-backup rotation, self-healing maintenance loops, and real-time WebSocket communication alongside RESTful API endpoints.

---

## 🚀 Features

* **🧠 Custom Knowledge Engine (`KnowledgeEngine`)**:
  * In-memory Map-based storage with fast lookup, normalization, and Jaccard similarity matching.
  * Interactive learning loop that flags queries needing training when confidence drops below thresholds.
* **⚡ Real-Time WebSocket Support**: Live training and instant query routing via WebSocket server connections.
* **🌐 RESTful API Endpoints**: Easily add, fetch, or purge knowledge programmatically via HTTP requests.
* **💾 Persistent Storage & Automated Backups**:
  * Auto-saves structured logs locally (`knowledge.log`).
  * Background auto-save intervals and clean exit handlers.
  * Automated backup rotation system keeping the last 7 historical backup snapshots.
* **🧹 Self-Healing & Maintenance**:
  * Automatic purging of corrupted data entries.
  * Conflict hashing to flag duplicate or competing knowledge pieces.
  * Automatic pruning of stale/unused knowledge older than configurable day thresholds (default: 90 days).
* **⚙ Command System**: Built-in command processor supporting utility triggers like `!help`, `!stats`, `!backup`, `!export`, `!list`, and `!reset`.

---

## 📁 Project Structure

```text
C:\lily\app\
├── server.js            # Express & WebSocket entry point server
├── engine/
│   └── knowledge.js     # Core KnowledgeEngine class & logic
├── public/              # Frontend static assets (HTML/CSS/JS)
├── backups/             # Automatic rolling backup logs
├── archive/             # Exported JSON knowledge archives
└── knowledge.log        # Active persistent knowledge data store

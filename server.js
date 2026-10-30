const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const KnowledgeEngine = require('./engine/knowledge');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
const nexus = new KnowledgeEngine();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  index: 'index.html'
}));

// API Endpoints
app.post('/api/learn', (req, res) => {
  const { question, answer } = req.body;
  nexus.addKnowledge({ question, answer });
  
  // Persistent storage
  fs.appendFileSync('knowledge.log', 
    `${Date.now()}|${question}|${answer}\n`
  );
  
  res.json({ status: 'success' });
});

app.get('/api/knowledge', (req, res) => {
  res.json(nexus.getKnowledge());
});

app.delete('/api/forget/:question', (req, res) => {
  res.json(nexus.forgetKnowledge(req.params.question));
});

// WebSocket Training
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const { type, data, learn } = JSON.parse(message);
      
      if (type === 'train') {
        nexus.addKnowledge(data);
        ws.send(JSON.stringify({
          type: 'training_result',
          success: true
        }));
      } 
      else if (type === 'query') {
        const response = nexus.processQuery(data, learn);
        ws.send(JSON.stringify({
          type: 'response',
          ...response,
          originalQuery: data
        }));
      }
    } catch (error) {
      console.error('WS Error:', error);
    }
  });
});

// Start Server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 AI Nexus Online\nhttp://localhost:${PORT}\nhttp://${getIP()}:${PORT}`);
});

function getIP() {
  return require('os').networkInterfaces().wlan0?.[0]?.address || 'localhost';
}
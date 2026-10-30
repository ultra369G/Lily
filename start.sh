#!/data/data/com.termux/files/usr/bin/bash

# Get IP address (works on most Android devices)
IP=$(ip addr show wlan0 | grep -w 'inet' | awk '{print $2}' | cut -d/ -f1)

# Fallback to localhost if IP detection fails
[ -z "$IP" ] && IP="127.0.0.1"

echo "🚀 AI Nexus Starting..."
echo "📡 Access URLs:"
echo "    - This device: http://localhost:8080"
echo "    - Local network: http://$IP:8080"
echo "🛑 Press Ctrl+C to stop"

# Start server
node server.js
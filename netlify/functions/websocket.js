/**
 * Netlify Serverless WebSocket Function
 * Handles real-time communication for the ThorEye Audit System
 */

const { WebSocketServer } = require('ws');
const queryString = require('querystring');

// Keep track of connected clients
const connectedClients = new Map();
const userStatusMap = new Map();

// Handle WebSocket connection setup
exports.handler = async (event, context) => {
  // Only handle WebSocket connections
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  // This handler is responsible for upgrading the connection
  // The actual WebSocket logic happens within the connection handler
  // which Netlify will manage once the upgrade is complete
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'ThorEye WebSocket Server',
    },
    body: JSON.stringify({ message: 'WebSocket connection initialization' }),
    isBase64Encoded: false,
  };
};

// WebSocket connection handler
exports.wsHandler = (ws, req) => {
  console.log('WebSocket connected');
  
  // Parse connection parameters (if any)
  const params = req.url?.includes('?') ? 
    queryString.parse(req.url.split('?')[1]) : {};
  
  // Generate a client ID if not provided
  const clientId = params.clientId || `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store new connection
  connectedClients.set(clientId, {
    ws,
    lastActivity: Date.now(),
    userId: params.userId,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection_established',
    clientId,
    timestamp: Date.now(),
    message: 'Connected to ThorEye WebSocket server'
  }));
  
  // Update user status if userId is provided
  if (params.userId) {
    updateUserStatus(params.userId, params.username || 'Anonymous', 'online');
  }
  
  // Setup ping-pong for connection health monitoring
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // 30-second ping interval
  
  // Handle received messages
  ws.on('message', (message) => {
    try {
      const client = connectedClients.get(clientId);
      if (client) {
        client.lastActivity = Date.now();
      }
      
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (err) {
        console.error('Invalid message format:', message);
        return;
      }
      
      // Handle different message types
      switch (parsedMessage.type) {
        case 'pong':
          // Client responded to ping, update last activity
          break;
          
        case 'user_status':
          // Update user status
          if (parsedMessage.userId) {
            updateUserStatus(
              parsedMessage.userId,
              parsedMessage.username || 'Anonymous',
              parsedMessage.status || 'online'
            );
          }
          break;
          
        case 'broadcast':
          // Broadcast message to all connected clients
          broadcast({
            type: 'broadcast',
            origin: clientId,
            content: parsedMessage.content,
            timestamp: Date.now()
          });
          break;
          
        case 'direct':
          // Send message to specific user
          if (parsedMessage.targetUserId) {
            sendToUser(parsedMessage.targetUserId, {
              type: 'direct',
              origin: clientId,
              content: parsedMessage.content,
              timestamp: Date.now()
            });
          }
          break;
          
        default:
          // Unknown message type
          console.log('Received message:', parsedMessage);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`WebSocket disconnected: ${clientId}`);
    
    // Get client info before removing
    const client = connectedClients.get(clientId);
    
    // Remove from connected clients
    connectedClients.delete(clientId);
    clearInterval(pingInterval);
    
    // Update user status if userId was provided
    if (client && client.userId) {
      updateUserStatus(client.userId, '', 'offline');
    }
    
    // Broadcast disconnection to all clients (optional)
    /*
    broadcast({
      type: 'user_disconnected',
      userId: client?.userId,
      clientId,
      timestamp: Date.now()
    });
    */
  });
};

// Broadcast message to all connected clients
function broadcast(message) {
  const messageString = JSON.stringify(message);
  connectedClients.forEach((client) => {
    try {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(messageString);
      }
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  });
}

// Send message to specific user
function sendToUser(userId, message) {
  const messageString = JSON.stringify(message);
  let sent = false;
  
  connectedClients.forEach((client) => {
    if (client.userId === userId && client.ws.readyState === client.ws.OPEN) {
      try {
        client.ws.send(messageString);
        sent = true;
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
      }
    }
  });
  
  return sent;
}

// Update user status
function updateUserStatus(userId, username, status) {
  // Store new status with timestamp
  userStatusMap.set(userId, {
    status,
    username: username || 'Unknown',
    timestamp: Date.now()
  });
  
  // Broadcast status update to all clients
  broadcast({
    type: 'user_status_update',
    userId,
    username: username || 'Unknown',
    status,
    timestamp: Date.now()
  });
}

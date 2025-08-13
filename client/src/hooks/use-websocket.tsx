/**
 * WebSocket hook for ThorEye Audit System
 * Handles WebSocket connections, reconnection logic, and message handling
 * with full support for Netlify serverless functions
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketHookOptions {
  reconnectInterval?: number;
  reconnectAttempts?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onReconnect?: (attempt: number) => void;
}

interface WebSocketHookReturn {
  sendMessage: (data: any) => void;
  lastMessage: MessageEvent | null;
  readyState: number;
  reconnect: () => void;
}

/**
 * React hook for WebSocket integration with automatic reconnection
 */
export function useWebSocket(url: string | null, options: WebSocketHookOptions = {}): WebSocketHookReturn {
  const {
    reconnectInterval = 5000,
    reconnectAttempts = Infinity,
    onOpen,
    onClose,
    onError,
    onMessage,
    onReconnect
  } = options;

  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);

  // Function to determine the WebSocket URL
  const getWebsocketUrl = useCallback(() => {
    if (!url) return null;
    
    // Check if we're running in Netlify serverless environment
    const isNetlify = window.location.hostname.includes('netlify.app') ||
                      window.location.hostname.includes('netlify.com');
    
    if (isNetlify) {
      // For Netlify, use the functions endpoint with appropriate protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    } else {
      // For local development or other environments, use the provided URL
      return url;
    }
  }, [url]);

  // Function to create and configure the WebSocket
  const connectWebSocket = useCallback(() => {
    const websocketUrl = getWebsocketUrl();
    if (!websocketUrl) return;

    // Clean up any existing socket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }

    // Create new WebSocket connection
    const ws = new WebSocket(websocketUrl);
    socketRef.current = ws;
    setReadyState(WebSocket.CONNECTING);

    // WebSocket event handlers
    ws.onopen = (event: Event) => {
      console.log(`WebSocket connected to ${websocketUrl}`);
      setReadyState(WebSocket.OPEN);
      reconnectCountRef.current = 0;
      if (onOpen) onOpen(event);
      
      // After connection established, send an identify message with user info if available
      const userJson = localStorage.getItem('qa-user');
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          if (user && user.id && user.username) {
            sendIdentify(ws, user.id, user.username, user.rights || []);
          }
        } catch (err) {
          console.error('Failed to parse user data for WebSocket identification:', err);
        }
      }
    };

    ws.onclose = (event: CloseEvent) => {
      console.log(`WebSocket disconnected from ${websocketUrl}`);
      setReadyState(WebSocket.CLOSED);
      if (onClose) onClose(event);

      // Attempt to reconnect if not at limit
      if (reconnectCountRef.current < reconnectAttempts) {
        const timeout = setTimeout(() => {
          reconnectCountRef.current++;
          if (onReconnect) onReconnect(reconnectCountRef.current);
          console.log(`Attempting to reconnect WebSocket (${reconnectCountRef.current}/${reconnectAttempts})`);
          connectWebSocket();
        }, reconnectInterval);
        reconnectTimerRef.current = timeout as unknown as number;
      }
    };

    ws.onerror = (event: Event) => {
      console.error('WebSocket error:', event);
      if (onError) onError(event);
    };

    ws.onmessage = (event: MessageEvent) => {
      setLastMessage(event);
      if (onMessage) onMessage(event);

      // Handle ping messages for keeping the connection alive
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          sendPong(ws, data.timestamp);
        }
      } catch (err) {
        // Not JSON or otherwise unparseable, ignore
      }
    };
  }, [getWebsocketUrl, onOpen, onClose, onError, onMessage, onReconnect, reconnectAttempts, reconnectInterval]);

  // Send an identify message to the server
  const sendIdentify = (socket: WebSocket, userId: string | number, username: string, rights: string[] = []) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'identify',
        userId: userId.toString(),
        username,
        rights,
        timestamp: Date.now()
      }));
    }
  };

  // Send a pong response to the server's ping
  const sendPong = (socket: WebSocket, timestamp: number) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'pong',
        timestamp,
        clientTime: Date.now()
      }));
    }
  };

  // Function to send a message through the WebSocket
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socketRef.current.send(message);
    } else {
      console.warn('Cannot send message - WebSocket is not connected');
    }
  }, []);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectCountRef.current = 0;
    connectWebSocket();
  }, [connectWebSocket]);

  // Connect when the component mounts, and disconnect when it unmounts
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return { sendMessage, lastMessage, readyState, reconnect };
}

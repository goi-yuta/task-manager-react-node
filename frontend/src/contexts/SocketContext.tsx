import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../config';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ token: string | null; children: React.ReactNode }> = ({ token, children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (token) {
      // サーバーのURLを取得（API_BASEから /api などを除いたベース部分）
      const socketUrl = API_BASE.replace('/api', ''); // config.tsに依存

      const newSocket = io(socketUrl, {
        auth: { token },
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      setSocket(null);
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

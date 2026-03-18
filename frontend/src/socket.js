import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_URL ||
  "https://classvibe-backend.onrender.com";

const socket = io(SOCKET_URL,"wss://classvibe-backend.onrender.com",  {
  path: "/socket.io",  
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true
});


export default socket;
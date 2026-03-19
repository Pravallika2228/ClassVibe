import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_URL ||
  "https://classvibe-backend.onrender.com";

const socket = io(SOCKET_URL, {
  path: "/socket.io",
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: false
});

export default socket;
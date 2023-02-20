import "dotenv/config";
import { createExpressMiddleware, type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { applyWSSHandler, type CreateWSSContextFnOptions } from '@trpc/server/adapters/ws';
import cors from 'cors';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { AppRouter, appRouter } from "./router";


// created for each request
const createContext = ({
  req,
  res,
}: CreateExpressContextOptions | CreateWSSContextFnOptions) => ({}); // no context

const PORT = '8080'

const app = express();
const server = http.createServer(app)
const wss = new WebSocketServer({ server })
const wsHandler = applyWSSHandler<AppRouter>({
  wss,
  router: appRouter,
  createContext,
})

app.use(cors())
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

server.listen(PORT, () => {
  console.log(`Listening at http://localhost:${PORT}`)
})
server.on('error', console.error)

process.on('SIGTERM', () => {
  wsHandler.broadcastReconnectNotification()
  wss.close()
  server.close()
})
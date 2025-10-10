// backend/server/index.ts
import express, { type Request, type Response, type NextFunction, type Express } from "express";
import cors from "cors";
import apiRouter from "./routes";
import "./lib/firebaseAdmin.ts";
import { createServer, type Server } from "http";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

// ✅ Import the single database instance
import { db } from "./db.ts"; // Removed databasePool if not directly used here

import { initSocket } from "./socket.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
let server: Server;

// CLIENT_URL को सीधे environment variable से पढ़ें, क्योंकि यह अब production के लिए ही होगा
// Production में, यह Frontend का URL होगा
// Development में, यह Vite Dev Server का URL होगा
const clientURL = process.env.CLIENT_URL || "http://shopnish.com"; // fallback


app.use(
  cors({
      origin: clientURL, // यह अब Frontend के URL के लिए कॉन्फ़िगर किया जाएगा
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
              credentials: true,
                })
                );

                app.use(express.json());
                app.use(express.urlencoded({ extended: false }));
                app.use(cookieParser());

                // --- Drizzle Migrations ---
                async function runMigrations() {
                  try {
                  const migrationsPath = path.resolve(__dirname, "migrations");
                    await migrate(db, { migrationsFolder: migrationsPath });
                   console.log("✅ Drizzle migrations completed.");
                      } catch (error: any) {
                      if (error?.code === "42P07") {
                      console.warn("⚠️ Table already exists. Skipping migration.");
                       } else {
                                    console.error("❌ Migration Error:", error);
                                           }
                                               } 
                }
                                // --- Start Server ---
                                      (async () => {
                                        await runMigrations();
                                                              console.log("✅ Migrations done. Starting server...");

                                                                // --- Request Logging Middleware ---
                                                                  app.use((req, res, next) => {
                                                                      const start = Date.now();
                                                                          const p = req.path;
                                                                              let captured: unknown;

                                                                                  const orig = res.json.bind(res);
                                                                                      res.json = (body, ...rest) => {
                                                                                            captured = body;
                                                                                                  return orig(body, ...rest);
                                                                                                      };

                                                                                                          res.on("finish", () => {
                                                                                                                if (!p.startsWith("/api")) return; // Only log API routes
                                                                                                                      const ms = Date.now() - start;
                                                                                                                            let line = `${req.method} ${p} ${res.statusCode} in ${ms}ms`;
                                                                                                                                  if (captured) line += ` :: ${JSON.stringify(captured)}`;
                                                                                                                                        console.log(line.length > 90 ? line.slice(0, 89) + "…" : line);
                                                                                                                                            });

                                                                                                                                                next();
                                                                                                                                                  });

                                                                                                                                                    // ⭐ 1. Register all API routes (SHOULD BE FIRST)
                                                                                                                                                      app.use("/api", apiRouter);

                                                                                                                                                        // ⭐ 2. Handle any non-API routes (Frontend now handles its own routing)
                                                                                                                                                          //    This means any request not handled by an API route should result in a 404
                                                                                                                                                            app.get("*", (req, res) => {
                                                                                                                                                                res.status(404).json({ message: "API route not found or invalid." });
                                                                                                                                                                  });

                                                                                                                                                                    // Global Error Handler
                                                                                                                                                                      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
                                                                                                                                                                          const status = err.status || err.statusCode || 500;
                                                                                                                                                                              const message = err.message || "Internal Server Error";
                                                                                                                                                                                  console.error("❌ Server Error:", err);
                                                                                                                                                                                      res.status(status).json({ message });
                                                                                                                                                                                        });

                                                                                                                                                                                          const port = process.env.PORT || 5001; // Render will provide PORT, fallback to 5001
                                                                                                                                                                                            server = createServer(app);

                                                                                                                                                                                              initSocket(server);

                                                                                                                                                                                                server.listen({ port, host: "0.0.0.0" }, () =>
                                                                                                                                                                                                    console.log(
                                                                                                                                                                                                          `🚀 Server listening on port ${port} in ${process.env.NODE_ENV || "development"} mode`
                                                                                                                                                                                                              )
                                                                                                                                                                                                                );
                                                                                                                                                                                                                })();


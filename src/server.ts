import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { rateLimiter } from "./middleware/rateLimiter";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";

// ====================== Routes
import { AuthRoutes } from "./routes/auth.routes";
import { UserRoutes } from "./routes/user.routes";
import { AgentRoutes } from "./routes/agent.routes";
// import { PropertyRoutes } from "./routes/PropertyRoutes";
// import { OfficeRoutes } from "./routes/OfficeRoutes";
// import { SearchRoutes } from "./routes/SearchRoutes";

// Load environment variables
dotenv.config();

class Server {
  public app: Application;
  private PORT: number;

  constructor() {
    this.app = express();
    this.PORT = parseInt(process.env.PORT || "5000");

    this.connectDatabase();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private async connectDatabase(): Promise<void> {
    try {
      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/remax-hub";

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(" Connected to MongoDB");
    } catch (error) {
      console.error(" MongoDB connection error:", error);
      process.exit(1);
    }
  }

  private configureMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
          },
        },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === "production"
            ? process.env.FRONTEND_URL
            : ["http://localhost:3000", "http://localhost:3001"],
        credentials: true,
        optionsSuccessStatus: 200,
      })
    );

    // Request logging
    this.app.use(morgan("combined"));

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    this.app.use(cookieParser());

    // Rate limiting
    this.app.use("/api/", rateLimiter);

    // Health check endpoint
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  private configureRoutes(): void {
    // // API routes
    this.app.use("/api/auth", new AuthRoutes().router);
    this.app.use("/api/users", new UserRoutes().router);
    this.app.use("/api/agents", new AgentRoutes().router);

    // this.app.use("/api/properties", new PropertyRoutes().router);
    // this.app.use("/api/offices", new OfficeRoutes().router);
    // this.app.use("/api/search", new SearchRoutes().router);

    // API documentation
    this.app.get("/api", (req: Request, res: Response) => {
      res.json({
        name: "RE/MAX Franchise API",
        version: "1.0.0",
        endpoints: {
          auth: "/api/auth",
          properties: "/api/properties",
          agents: "/api/agents",
          offices: "/api/offices",
          users: "/api/users",
          search: "/api/search",
        },
      });
    });
  }

  private configureErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public start(): void {
    this.app.listen(this.PORT, () => {
      console.log(`🚀 Server running on port ${this.PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${this.PORT}/health`);
    });
  }
}

// Start the server
const server = new Server();
server.start();

export default server.app;

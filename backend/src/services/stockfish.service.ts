import { spawn, ChildProcess } from "child_process";

/**
 * Depth presets for analysis
 */
export const AnalysisDepth = {
  fast: 20, // Minimum depth for reliable evaluation
  balanced: 25, // Matches Lichess server analysis depth
  thorough: 30, // Deep analysis for critical games
} as const;

export type DepthPreset = keyof typeof AnalysisDepth;

/**
 * Analysis result from Stockfish
 */
export interface StockfishAnalysis {
  bestMove: string; // e.g., "e2e4"
  bestLine: string[]; // Principal variation (PV) - sequence of best moves
  evaluation: number; // Centipawn score (positive = white advantage)
  mateIn?: number; // If mate found, moves until mate (positive = white mates, negative = black mates)
  depth: number; // Depth reached
}

/**
 * Stockfish Service
 * Manages communication with Stockfish chess engine via UCI protocol
 */
export class StockfishService {
  private engine: ChildProcess | null = null;
  private isReady: boolean = false;
  private outputBuffer: string[] = [];

  /**
   * Start the Stockfish engine
   */
  async startEngine(): Promise<void> {
    if (this.engine) {
      console.warn("⚠️ Engine already running");
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Spawn Stockfish process
        this.engine = spawn("stockfish");

        if (!this.engine || !this.engine.stdin || !this.engine.stdout) {
          throw new Error("Failed to spawn Stockfish process");
        }

        // Handle stdout
        this.engine.stdout.on("data", (data: Buffer) => {
          const output = data.toString();
          this.outputBuffer.push(output);

          // Check if engine is ready
          if (output.includes("uciok")) {
            this.isReady = true;
            console.log("✅ Stockfish engine initialized");
            resolve();
          }
        });

        // Handle stderr
        this.engine.stderr?.on("data", (data: Buffer) => {
          console.error("❌ Stockfish error:", data.toString());
        });

        // Handle process errors
        this.engine.on("error", (error) => {
          console.error("❌ Stockfish process error:", error);
          reject(error);
        });

        // Initialize UCI mode
        this.sendCommand("uci");

        // Timeout if engine doesn't respond
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error("Stockfish failed to initialize (timeout)"));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the Stockfish engine
   */
  stopEngine(): void {
    if (this.engine) {
      this.sendCommand("quit");
      this.engine.kill();
      this.engine = null;
      this.isReady = false;
      console.log("👋 Stockfish engine stopped");
    }
  }

  /**
   * Analyze a chess position
   * @param fen - Position in FEN notation
   * @param depthOrPreset - Analysis depth (number) or preset ('fast', 'balanced', 'thorough')
   * @returns Analysis result with best move, best line, and evaluation
   */
  async analyzePosition(
    fen: string,
    depthOrPreset: number | DepthPreset = "fast"
  ): Promise<StockfishAnalysis> {
    if (!this.engine || !this.isReady) {
      throw new Error("Stockfish engine not started");
    }

    // Convert preset to depth number
    const depth =
      typeof depthOrPreset === "string"
        ? AnalysisDepth[depthOrPreset]
        : depthOrPreset;

    return new Promise((resolve, reject) => {
      this.outputBuffer = []; // Clear buffer

      // Store engine reference (we already checked it's not null)
      const engine = this.engine;
      if (!engine) {
        reject(new Error('Engine is null'));
        return;
      }

      let bestMove = "";
      let pv: string[] = [];
      let score = 0;
      let mateIn: number | undefined;
      let currentDepth = 0;

      // Set up data listener for this analysis
      const dataHandler = (data: Buffer) => {
        const output = data.toString();
        const lines = output.split("\n");

        for (const line of lines) {
          // Parse depth
          if (line.includes("depth")) {
            const depthMatch = line.match(/depth (\d+)/);
            if (depthMatch) {
              currentDepth = parseInt(depthMatch[1]);
            }
          }

          // Parse score (centipawn or mate)
          if (line.includes("score")) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            const mateMatch = line.match(/score mate (-?\d+)/);

            if (mateMatch) {
              mateIn = parseInt(mateMatch[1]);
              score = mateIn > 0 ? 100000 : -100000; // Large value for mate
            } else if (cpMatch) {
              score = parseInt(cpMatch[1]);
              mateIn = undefined;
            }
          }

          // Parse principal variation (best line)
          if (line.includes("pv")) {
            const pvMatch = line.match(/pv (.+)/);
            if (pvMatch) {
              pv = pvMatch[1]
                .trim()
                .split(" ")
                .filter((m) => m.length > 0);
              bestMove = pv[0] || "";
            }
          }

          // Check if analysis complete
          if (line.startsWith("bestmove")) {
            const moveMatch = line.match(/bestmove (\S+)/);
            // Always use the final bestmove from Stockfish (overwrites any pv-extracted move)
            if (moveMatch) {
              bestMove = moveMatch[1];
            }

            // Remove listener
            engine.stdout?.off("data", dataHandler);

            // Resolve with results
            resolve({
              bestMove,
              bestLine: pv.slice(0, 10), // Limit to first 10 moves
              evaluation: score,
              mateIn,
              depth: currentDepth,
            });
          }
        }
      };

      // Attach data handler
      engine.stdout?.on("data", dataHandler);

      // Send analysis commands
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);

      // Timeout protection
      setTimeout(() => {
        engine.stdout?.off("data", dataHandler);
        reject(new Error(`Analysis timeout after ${depth} depth`));
      }, 120000); // 2 minute timeout
    });
  }

  /**
   * Send a command to Stockfish
   */
  private sendCommand(command: string): void {
    if (this.engine && this.engine.stdin) {
      this.engine.stdin.write(command + "\n");
    }
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this.engine !== null && this.isReady;
  }
}

/**
 * Global Stockfish instance
 * Reuse the same engine to avoid spawning multiple processes
 */
let globalEngine: StockfishService | null = null;

export async function getStockfishEngine(): Promise<StockfishService> {
  if (!globalEngine) {
    globalEngine = new StockfishService();
    await globalEngine.startEngine();
  }

  if (!globalEngine.isRunning()) {
    await globalEngine.startEngine();
  }

  return globalEngine;
}

export function shutdownStockfish(): void {
  if (globalEngine) {
    globalEngine.stopEngine();
    globalEngine = null;
  }
}

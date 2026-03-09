package main

import (
	"log"
	"os"

	"github.com/mark3labs/mcp-go/server"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/mcp"
)

func main() {
	// Root directory to expose
	basePath := os.Getenv("MCP_ALLOWED_PATH")
	if basePath == "" {
		// Fallback to current working directory if not specified
		cwd, err := os.Getwd()
		if err != nil {
			log.Fatalf("Failed to get current directory: %v", err)
		}
		basePath = cwd
	}

	log.Printf("Starting Proximus-Nova MCP Server exposing sandbox: %s", basePath)

	// Create and initialize the server instance
	s := mcp.InitServer(basePath)

	// In MCP, servers typically run using stdio for local orchestration.
	// We'll use ServeStdio which communicates via the process's standard streams.
	if err := server.ServeStdio(s); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

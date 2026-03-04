package grpcclient

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/DsThakurRawat/autonomous-org/go-backend/proto/gen/orchestrator"
)

type OrchestratorClient struct {
	pb.OrchestratorServiceClient
	conn *grpc.ClientConn
}

func NewOrchestratorClient(ctx context.Context, target string) (*OrchestratorClient, error) {
	// Connect to gRPC server using insecure credentials (for internal microservice networking)
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("grpc: failed to dial orchestrator at %s: %w", target, err)
	}

	client := pb.NewOrchestratorServiceClient(conn)

	return &OrchestratorClient{
		OrchestratorServiceClient: client,
		conn:                      conn,
	}, nil
}

func (c *OrchestratorClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

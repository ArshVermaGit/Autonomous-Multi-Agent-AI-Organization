// Orchestrator Service — main entrypoint
// Manages the DAG execution engine: plans tasks, dispatches to Kafka,
// processes results, handles retries, and tracks project lifecycle.
package main

import (
	"context"
	"net"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/orchestrator/server"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/config"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/db"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/kafka"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/logger"
	pb "github.com/DsThakurRawat/autonomous-org/go-backend/proto/gen/orchestrator"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg, err := config.Load("orchestrator")
	if err != nil {
		panic(err)
	}

	if err := logger.Init(cfg.ServiceName, cfg.Observ.LogLevel, cfg.Observ.LogJSON); err != nil {
		panic(err)
	}
	defer logger.Sync()
	log := logger.L()

	log.Info("orchestrator starting", zap.String("env", cfg.Env))

	// ── Postgres ─────────────────────────────────────────────────────────
	pgPool, err := db.New(ctx, &cfg.Postgres)
	if err != nil {
		log.Fatal("postgres failed", zap.Error(err))
	}
	defer pgPool.Close()

	// ── Kafka Producer (for publishing tasks) ────────────────────────────
	producer, err := kafka.NewProducer(&cfg.Kafka)
	if err != nil {
		log.Fatal("kafka producer failed", zap.Error(err))
	}
	defer producer.Close()

	// ── Kafka Consumer (for consuming results) ────────────────────────────
	resultConsumer, err := kafka.NewConsumerGroup(
		&cfg.Kafka,
		"orchestrator-results",
		[]string{cfg.Kafka.TopicResults},
		func(ctx context.Context, msg kafka.Message) error {
			log.Info("result received",
				zap.String("topic", msg.Topic),
				zap.String("key", msg.Key),
				zap.Int("value_len", len(msg.Value)),
			)
			// TODO: parse ResultMessage → call dag.MarkDone/MarkFailed → dispatch next tasks
			return nil
		},
	)
	if err != nil {
		log.Fatal("kafka consumer failed", zap.Error(err))
	}

	// ── Start Consumer in background ─────────────────────────────────────
	go func() {
		if err := resultConsumer.Consume(ctx); err != nil {
			log.Error("consumer stopped", zap.Error(err))
		}
	}()

	// ── gRPC Server (for Gateway calls) ─────────────────────────────────
	lis, err := net.Listen("tcp", cfg.GRPCAddr())
	if err != nil {
		log.Fatal("failed to listen", zap.Error(err))
	}

	grpcServer := grpc.NewServer()

	orchServer := server.NewOrchestratorServer(pgPool, producer)
	pb.RegisterOrchestratorServiceServer(grpcServer, orchServer)

	// Register reflection service on gRPC server (useful for evans / grpcui)
	reflection.Register(grpcServer)

	go func() {
		log.Info("orchestrator grpc listening", zap.String("grpc_addr", cfg.GRPCAddr()))
		if err := grpcServer.Serve(lis); err != nil {
			log.Error("grpc serve error", zap.Error(err))
		}
	}()

	log.Info("orchestrator ready",
		zap.Strings("kafka_brokers", cfg.Kafka.Brokers),
	)

	// ── Graceful Shutdown ─────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Info("orchestrator shutting down")
	grpcServer.GracefulStop()
	cancel()
	_ = resultConsumer.Close()
	log.Info("orchestrator stopped cleanly")
}

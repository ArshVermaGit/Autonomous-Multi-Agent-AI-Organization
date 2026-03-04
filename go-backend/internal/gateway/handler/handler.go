package handler

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/gateway/grpcclient"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/logger"
	pb "github.com/DsThakurRawat/autonomous-org/go-backend/proto/gen/orchestrator"
)

// Handler holds the dependencies mapped to HTTP routes
type Handler struct {
	OrchClient *grpcclient.OrchestratorClient
}

func NewHandler(orchClient *grpcclient.OrchestratorClient) *Handler {
	return &Handler{
		OrchClient: orchClient,
	}
}

// ── Request/Response types ────────────────────────────────────────────────────

type CreateProjectRequest struct {
	Idea   string      `json:"idea" validate:"required,min=10,max=2000"`
	Budget BudgetInput `json:"budget"`
}

type BudgetInput struct {
	MaxCostUSD float64 `json:"max_cost_usd"`
	MaxTokens  int64   `json:"max_tokens"`
}

type ProjectResponse struct {
	ProjectID string    `json:"project_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	Message   string    `json:"message,omitempty"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Error   string `json:"error"`
	TraceID string `json:"trace_id,omitempty"`
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// CreateProject handles POST /v1/projects
func (h *Handler) CreateProject(c *fiber.Ctx) error {
	log := logger.L().With(
		zap.String("handler", "CreateProject"),
		zap.String("trace_id", c.Locals("trace_id").(string)),
	)

	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(ErrorResponse{
			Code:    400,
			Error:   "invalid request body: " + err.Error(),
			TraceID: c.Locals("trace_id").(string),
		})
	}

	if len(req.Idea) < 10 {
		return c.Status(fiber.StatusBadRequest).JSON(ErrorResponse{
			Code:  400,
			Error: "idea must be at least 10 characters",
		})
	}

	// Assuming jwt middleware sets these
	userID, _ := c.Locals("user_id").(string)
	tenantID, _ := c.Locals("tenant_id").(string)

	resp, err := h.OrchClient.CreateProject(context.Background(), &pb.CreateProjectRequest{
		TenantId: tenantID,
		UserId:   userID,
		Idea:     req.Idea,
		Budget: &pb.BudgetConfig{
			MaxCostUsd: req.Budget.MaxCostUSD,
			MaxTokens:  req.Budget.MaxTokens,
		},
	})

	if err != nil {
		log.Error("failed to create project via gRPC", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{
			Code:    500,
			Error:   "internal logic failure: " + err.Error(),
			TraceID: c.Locals("trace_id").(string),
		})
	}

	return c.Status(fiber.StatusAccepted).JSON(ProjectResponse{
		ProjectID: resp.GetProjectId(),
		Status:    resp.GetStatus().String(),
		CreatedAt: resp.GetCreatedAt().AsTime(),
		Message:   "Project queued. Connect to /v1/projects/" + resp.GetProjectId() + "/stream for live updates.",
	})
}

// GetProject handles GET /v1/projects/:id
func (h *Handler) GetProject(c *fiber.Ctx) error {
	projectID := c.Params("id")
	tenantID, _ := c.Locals("tenant_id").(string)

	if projectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(ErrorResponse{Code: 400, Error: "project_id required"})
	}

	resp, err := h.OrchClient.GetProject(context.Background(), &pb.GetProjectRequest{
		ProjectId: projectID,
		TenantId:  tenantID,
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"project_id": resp.GetProjectId(),
		"status":     resp.GetStatus().String(),
		"tenant_id":  resp.GetTenantId(),
	})
}

// ListProjects handles GET /v1/projects
func (h *Handler) ListProjects(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"projects": []any{}, "total": 0})
}

// CancelProject handles DELETE /v1/projects/:id
func (h *Handler) CancelProject(c *fiber.Ctx) error {
	projectID := c.Params("id")

	resp, err := h.OrchClient.CancelProject(context.Background(), &pb.CancelProjectRequest{
		ProjectId: projectID,
		Reason:    "Requested via API",
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success":    resp.GetSuccess(),
		"message":    resp.GetMessage(),
		"project_id": projectID,
	})
}

// GetCostReport handles GET /v1/projects/:id/cost
func (h *Handler) GetCostReport(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{})
}

// HealthCheck handles GET /healthz
func (h *Handler) HealthCheck(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
}

// ReadyCheck handles GET /readyz
func (h *Handler) ReadyCheck(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ready"})
}

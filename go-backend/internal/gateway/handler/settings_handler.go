// settings_handler.go — REST handlers for user LLM key management & agent model preferences
//
// Routes (registered in cmd/gateway/main.go under /v1/settings):
//
//	POST   /v1/settings/keys              — Add a new API key for a provider
//	GET    /v1/settings/keys              — List all keys (no raw values, hint only)
//	DELETE /v1/settings/keys/:id         — Remove a specific key by ID
//	POST   /v1/settings/keys/:id/validate — Mark a key valid/invalid (called after 401)
//	POST   /v1/settings/agent-prefs      — Set model preference for an agent role
//	GET    /v1/settings/agent-prefs      — Get all agent preferences for the user
//	DELETE /v1/settings/agent-prefs/:role — Reset a role to system defaults
package handler

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/db"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/keystore"
	"github.com/DsThakurRawat/autonomous-org/go-backend/internal/shared/logger"
)

type SettingsHandler struct {
	db *db.Pool
}

func NewSettingsHandler(pool *db.Pool) *SettingsHandler {
	return &SettingsHandler{db: pool}
}

// ── Request / Response types ──────────────────────────────────────────────────

type AddKeyRequest struct {
	Provider string `json:"provider" validate:"required,oneof=openai anthropic google"`
	APIKey   string `json:"api_key"  validate:"required,min=20"`
	Label    string `json:"label"`
}

type KeyResponse struct {
	ID        string    `json:"id"`
	Provider  string    `json:"provider"`
	Label     string    `json:"label"`
	KeyHint   string    `json:"key_hint"`
	IsValid   bool      `json:"is_valid"`
	CreatedAt time.Time `json:"created_at"`
}

type SetAgentPrefRequest struct {
	AgentRole string         `json:"agent_role"  validate:"required"`
	Provider  string         `json:"provider"    validate:"required,oneof=openai anthropic google"`
	ModelName string         `json:"model_name"  validate:"required"`
	KeyID     string         `json:"key_id"` // optional — specific key to use
	Params    map[string]any `json:"model_params"`
}

type AgentPrefResponse struct {
	ID        string         `json:"id"`
	AgentRole string         `json:"agent_role"`
	Provider  string         `json:"provider"`
	ModelName string         `json:"model_name"`
	KeyID     *string        `json:"key_id"`
	Params    map[string]any `json:"model_params"`
	IsDefault bool           `json:"is_default"` // true if no custom pref set
}

// ── Key Handlers ──────────────────────────────────────────────────────────────

// AddKey handles POST /v1/settings/keys
// Encrypts the API key, stores in user_llm_keys, returns a safe KeyResponse.
func (h *SettingsHandler) AddKey(c *fiber.Ctx) error {
	log := logger.L().With(zap.String("handler", "AddKey"))
	userID := c.Locals("user_id").(string)

	var req AddKeyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(ErrorResponse{Code: 400, Error: "invalid request body"})
	}

	if req.Label == "" {
		req.Label = "default"
	}

	// Encrypt the raw API key — plaintext only lives in this stack frame
	enc, err := keystore.Encrypt(req.APIKey)
	if err != nil {
		log.Error("failed to encrypt api key", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: "key encryption failed"})
	}

	hint := keystore.KeyHint(req.APIKey) // "...Xk9p"

	// Insert into DB
	query := `
		INSERT INTO user_llm_keys (user_id, provider, key_label, api_key_enc, key_hint)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	var keyID string
	var createdAt time.Time
	err = h.db.QueryRow(
		context.Background(), query,
		userID, req.Provider, req.Label, enc, hint,
	).Scan(&keyID, &createdAt)

	if err != nil {
		log.Error("db insert failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: "db write failed"})
	}

	log.Info("api key saved", zap.String("provider", req.Provider), zap.String("key_id", keyID))

	return c.Status(fiber.StatusCreated).JSON(KeyResponse{
		ID:        keyID,
		Provider:  req.Provider,
		Label:     req.Label,
		KeyHint:   hint,
		IsValid:   true,
		CreatedAt: createdAt,
	})
}

// ListKeys handles GET /v1/settings/keys
// Returns all keys for the user — NEVER returns the encrypted blob or raw key.
func (h *SettingsHandler) ListKeys(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(
		context.Background(),
		`SELECT id, provider, key_label, key_hint, is_valid, created_at
		 FROM user_llm_keys WHERE user_id = $1 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: err.Error()})
	}
	defer rows.Close()

	var keys []KeyResponse
	for rows.Next() {
		var k KeyResponse
		if err := rows.Scan(&k.ID, &k.Provider, &k.Label, &k.KeyHint, &k.IsValid, &k.CreatedAt); err != nil {
			continue
		}
		keys = append(keys, k)
	}

	if keys == nil {
		keys = []KeyResponse{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"keys": keys, "total": len(keys)})
}

// DeleteKey handles DELETE /v1/settings/keys/:id
func (h *SettingsHandler) DeleteKey(c *fiber.Ctx) error {
	keyID := c.Params("id")
	userID := c.Locals("user_id").(string)

	res, err := h.db.Exec(
		context.Background(),
		`DELETE FROM user_llm_keys WHERE id = $1 AND user_id = $2`,
		keyID, userID,
	)
	if err != nil || res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(ErrorResponse{Code: 404, Error: "key not found"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"deleted": keyID})
}

// ── Agent Preference Handlers ─────────────────────────────────────────────────

// SetAgentPref handles POST /v1/settings/agent-prefs
// Upserts a model preference for a specific agent role.
func (h *SettingsHandler) SetAgentPref(c *fiber.Ctx) error {
	log := logger.L().With(zap.String("handler", "SetAgentPref"))
	userID := c.Locals("user_id").(string)

	var req SetAgentPrefRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(ErrorResponse{Code: 400, Error: "invalid request body"})
	}

	validRoles := map[string]bool{
		"CEO": true, "CTO": true, "Engineer_Backend": true,
		"Engineer_Frontend": true, "QA": true, "DevOps": true, "Finance": true,
	}
	if !validRoles[req.AgentRole] {
		return c.Status(fiber.StatusBadRequest).JSON(ErrorResponse{Code: 400, Error: "unknown agent_role"})
	}

	var keyIDPtr *string
	if req.KeyID != "" {
		keyIDPtr = &req.KeyID
	}

	params := req.Params
	if params == nil {
		params = map[string]any{}
	}

	// Upsert — update model if pref already exists for this user+role
	query := `
		INSERT INTO agent_model_prefs (user_id, agent_role, provider, model_name, key_id, model_params)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, agent_role) DO UPDATE
			SET provider = EXCLUDED.provider,
			    model_name = EXCLUDED.model_name,
			    key_id = EXCLUDED.key_id,
			    model_params = EXCLUDED.model_params,
			    updated_at = NOW()
		RETURNING id`

	var prefID string
	err := h.db.QueryRow(
		context.Background(), query,
		userID, req.AgentRole, req.Provider, req.ModelName, keyIDPtr, params,
	).Scan(&prefID)

	if err != nil {
		log.Error("agent pref upsert failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: "db write failed"})
	}

	return c.Status(fiber.StatusOK).JSON(AgentPrefResponse{
		ID:        prefID,
		AgentRole: req.AgentRole,
		Provider:  req.Provider,
		ModelName: req.ModelName,
		KeyID:     keyIDPtr,
		Params:    params,
		IsDefault: false,
	})
}

// GetAgentPrefs handles GET /v1/settings/agent-prefs
// Returns all configured agent prefs, filling in defaults for unconfigured roles.
func (h *SettingsHandler) GetAgentPrefs(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(
		context.Background(),
		`SELECT id, agent_role, provider, model_name, key_id::text, model_params
		 FROM agent_model_prefs WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: err.Error()})
	}
	defer rows.Close()

	configured := map[string]AgentPrefResponse{}
	for rows.Next() {
		var p AgentPrefResponse
		var keyIDStr *string
		if err := rows.Scan(&p.ID, &p.AgentRole, &p.Provider, &p.ModelName, &keyIDStr, &p.Params); err != nil {
			continue
		}
		p.KeyID = keyIDStr
		p.IsDefault = false
		configured[p.AgentRole] = p
	}

	// Fill in default for roles not yet configured by user
	allRoles := []string{"CEO", "CTO", "Engineer_Backend", "Engineer_Frontend", "QA", "DevOps", "Finance"}
	result := make([]AgentPrefResponse, 0, len(allRoles))
	for _, role := range allRoles {
		if pref, ok := configured[role]; ok {
			result = append(result, pref)
		} else {
			def := keystore.AgentDefaults[role]
			result = append(result, AgentPrefResponse{
				AgentRole: role,
				Provider:  def.Provider,
				ModelName: def.ModelName,
				IsDefault: true,
				Params:    map[string]any{},
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"prefs": result})
}

// DeleteAgentPref handles DELETE /v1/settings/agent-prefs/:role
// Resets the role to system defaults by removing the custom row.
func (h *SettingsHandler) DeleteAgentPref(c *fiber.Ctx) error {
	role := c.Params("role")
	userID := c.Locals("user_id").(string)

	_, err := h.db.Exec(
		context.Background(),
		`DELETE FROM agent_model_prefs WHERE user_id = $1 AND agent_role = $2`,
		userID, role,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(ErrorResponse{Code: 500, Error: err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"role": role, "reset_to_default": true})
}

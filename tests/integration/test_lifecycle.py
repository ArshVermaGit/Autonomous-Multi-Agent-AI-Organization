import asyncio
from unittest.mock import MagicMock

import pytest

from agents.roles import AgentRole
from orchestrator.planner import OrchestratorEngine


class MockAgent:
    def __init__(self, role):
        self.ROLE = role
        self.llm_client = MagicMock()
        self.model_name = "mock-model"
        self.provider = "mock"

    async def run(self, **kwargs):
        # Return a structure that makes sense for multiple roles
        return {
            "status": "success",
            "result": f"Mock output from {self.ROLE}",
            "mvp_features": [],  # For CEO
            "estimated_monthly_cost_usd": 50,  # For CTO
        }

    async def execute_task(self, task, context):
        return await self.run()

    async def self_critique(self, output):
        return {
            **output,
            "_critique": {
                "scores": {
                    "completeness": 9,
                    "correctness": 9,
                    "safety": 10,
                    "cost": 8,
                },
                "approved": True,
            },
        }


@pytest.mark.asyncio
async def test_full_lifecycle_simulation():
    """Test the OrchestratorEngine lifecycle with mock agents for all roles."""
    engine = OrchestratorEngine(budget_usd=100.0)

    # Register mock agents for ALL roles used in build_standard_task_graph
    roles_to_mock = [
        AgentRole.CEO,
        AgentRole.CTO,
        AgentRole.DEVOPS,
        AgentRole.ENGINEER_BACKEND,
        AgentRole.ENGINEER_FRONTEND,
        AgentRole.QA,
        AgentRole.FINANCE,
    ]

    for role in roles_to_mock:
        engine.register_agent(role, MockAgent(role))

    # Setup event capture
    events = []

    def capture_event(event):
        events.append(event)

    engine.subscribe_events(capture_event)

    # Start project
    project_id = await engine.start_project("Build a mock system")
    assert project_id is not None

    # Wait for completion (simulated background task)
    max_wait = 20  # Increased wait time
    status = None
    while max_wait > 0:
        status = engine.get_project_status(project_id)
        if status and status["status"] in ["completed", "failed"]:
            break
        await asyncio.sleep(1.0)
        max_wait -= 1

    assert status is not None
    if status["status"] == "failed":
        tasks = status.get("task_graph", {}).get("nodes", [])
        failed_tasks = [t for t in tasks if t["status"] == "failed"]
        error_msg = failed_tasks[0]["error"] if failed_tasks else "Unknown error"
        pytest.fail(f"Project failed with error: {error_msg}")

    assert status["status"] == "completed"
    assert "business_plan" in status["memory_snapshot"]
    assert "architecture" in status["memory_snapshot"]

    # Verify self-critique happened and data aggregation works
    critique_events = [
        e
        for e in events
        if e.agent_role == AgentRole.ORCHESTRATOR and "Evaluation complete" in e.message
    ]
    assert len(critique_events) > 0
    assert "average_quality_score" in critique_events[0].data
    assert "reflections" in critique_events[0].data
    assert len(critique_events[0].data["reflections"]) > 0

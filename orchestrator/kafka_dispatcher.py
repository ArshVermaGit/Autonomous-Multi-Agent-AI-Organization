"""
Kafka-Backed Orchestrator Dispatcher
=====================================
Replaces direct agent.execute_task() calls with:
  1. Publish TaskMessage → ai-org.tasks.<role>
  2. Await ResultMessage on ai-org.results.<project_id>
  3. Continue DAG on success / retry on failure

This is what makes the system truly distributed — each agent
runs as an independent microservice consuming from its own topic.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import structlog

from messaging.kafka_client import KafkaProducerClient, KafkaConsumerClient
from messaging.topics import KafkaTopics
from messaging.schemas import TaskMessage, ResultMessage, EventMessage
from orchestrator.task_graph import Task, TaskStatus

logger = structlog.get_logger(__name__)


class KafkaDispatcher:
    """
    Dispatches tasks to agent microservices via Kafka and awaits results.

    Flow:
      dispatch_task(task) → publishes to ai-org.tasks.<agent_role>
      await_result(task_id, timeout) → consumes from ai-org.results.<project_id>
      returns ResultMessage
    """

    def __init__(
        self,
        project_id: str,
        producer: Optional[KafkaProducerClient] = None,
        result_timeout_sec: float = 300.0,   # 5 min default per task
    ):
        self.project_id       = project_id
        self.result_timeout   = result_timeout_sec
        self._producer        = producer or KafkaProducerClient()
        self._pending: Dict[str, asyncio.Future] = {}   # task_id → Future[ResultMessage]
        self._consumer_task: Optional[asyncio.Task] = None
        self._consumer: Optional[KafkaConsumerClient] = None

    async def start(self):
        """Start the result consumer loop for this project."""
        result_topic = KafkaTopics.task_result(self.project_id)
        self._consumer = KafkaConsumerClient(
            topics=[result_topic],
            group_id=f"orchestrator-{self.project_id[:8]}",
        )
        self._consumer_task = asyncio.create_task(
            self._consume_results_loop(),
            name=f"result-consumer-{self.project_id[:8]}"
        )
        logger.info("KafkaDispatcher started", project_id=self.project_id, result_topic=result_topic)

    async def stop(self):
        """Stop the result consumer."""
        if self._consumer_task:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
        if self._consumer:
            await self._consumer.close()
        logger.info("KafkaDispatcher stopped", project_id=self.project_id)

    async def dispatch_task(
        self,
        task: Task,
        input_data: Dict[str, Any],
        priority: int = 5,
        trace_id: Optional[str] = None,
    ) -> asyncio.Future:
        """
        Publish a task to the appropriate agent's Kafka topic.
        Returns a Future that resolves when the result arrives.
        """
        task_id  = task.id
        trace_id = trace_id or str(uuid.uuid4()).replace("-", "")[:16]

        msg = TaskMessage(
            task_id    = task_id,
            task_name  = task.name,
            task_type  = task.task_type or task.agent_role.lower(),
            agent_role = task.agent_role,
            project_id = self.project_id,
            input_data = input_data,
            priority   = priority,
            trace_id   = trace_id,
        )

        topic = KafkaTopics.agent_task_topic(task.agent_role)

        # Create result future before publishing (avoid race condition)
        loop   = asyncio.get_event_loop()
        future = loop.create_future()
        self._pending[task_id] = future

        ok = await self._producer.publish_model(
            topic   = topic,
            model   = msg,
            key     = task_id,
        )

        if not ok:
            del self._pending[task_id]
            future.set_exception(RuntimeError(f"Failed to publish task {task_id} to {topic}"))
            return future

        logger.info(
            "Task dispatched",
            task_id    = task_id,
            task_name  = task.name,
            agent_role = task.agent_role,
            topic      = topic,
            trace_id   = trace_id,
        )
        return future

    async def dispatch_and_wait(
        self,
        task: Task,
        input_data: Dict[str, Any],
        priority: int = 5,
        trace_id: Optional[str] = None,
    ) -> ResultMessage:
        """
        Dispatch task and block until result arrives or timeout.
        Raises TimeoutError or RuntimeError on failure.
        """
        future = await self.dispatch_task(task, input_data, priority, trace_id)

        try:
            result: ResultMessage = await asyncio.wait_for(
                asyncio.shield(future),
                timeout=self.result_timeout
            )
            return result
        except asyncio.TimeoutError:
            self._pending.pop(task.id, None)
            raise TimeoutError(
                f"Task {task.id} ({task.name}) timed out after {self.result_timeout}s"
            )

    async def _consume_results_loop(self):
        """
        Background loop: consume ResultMessages from ai-org.results.<project_id>
        and resolve the pending futures.
        """
        logger.info("Result consumer loop started", project_id=self.project_id)
        try:
            async for raw_msg in self._consumer.consume_stream():
                try:
                    result = ResultMessage(**raw_msg)
                    task_id = result.task_id

                    future = self._pending.pop(task_id, None)
                    if future and not future.done():
                        if result.status == "completed":
                            future.set_result(result)
                        else:
                            future.set_exception(
                                RuntimeError(f"Agent reported failure: {result.error_message}")
                            )
                    else:
                        logger.warning("Received result for unknown task", task_id=task_id)

                except Exception as e:
                    logger.error("Failed to process result message", error=str(e))

        except asyncio.CancelledError:
            logger.info("Result consumer loop cancelled", project_id=self.project_id)
        except Exception as e:
            logger.error("Result consumer loop crashed", error=str(e), project_id=self.project_id)


class KafkaEventPublisher:
    """
    Publishes ExecutionEvents to Kafka (ai-org.events.project_id)
    so the dashboard WebSocket can stream them to the browser.
    """

    def __init__(self, project_id: str, producer: Optional[KafkaProducerClient] = None):
        self.project_id = project_id
        self._producer  = producer or KafkaProducerClient()

    async def publish_event(
        self,
        event_type: str,
        agent_role: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        level: str = "info",
        trace_id: Optional[str] = None,
    ):
        """Publish a structured event to the project's event topic."""
        msg = EventMessage(
            event_type = event_type,
            agent_role = agent_role,
            message    = message,
            data       = data or {},
            level      = level,
            project_id = self.project_id,
            trace_id   = trace_id or "",
        )

        topic = KafkaTopics.project_events(self.project_id)
        await self._producer.publish(topic=topic, message=msg, key=event_type)

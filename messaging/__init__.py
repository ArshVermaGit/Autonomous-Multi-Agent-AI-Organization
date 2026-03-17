"""
Messaging Layer - Kafka-based distributed communication.
Provides async producer/consumer base classes and message schemas.
"""

from .kafka_client import KafkaConsumerClient, KafkaProducerClient
from .schemas import (
    ErrorMessage,
    EventMessage,
    MetricMessage,
    ResultMessage,
    TaskMessage,
)
from .topics import KafkaTopics

__all__ = [
    "ErrorMessage",
    "EventMessage",
    "KafkaConsumerClient",
    "KafkaProducerClient",
    "KafkaTopics",
    "MetricMessage",
    "ResultMessage",
    "TaskMessage",
]

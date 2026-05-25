import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable


@dataclass
class QueueItem:
    user_id: str
    candidate_id: str
    analysis_run_id: str


class AnalysisQueueManager:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[QueueItem] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None
        self._processor: Callable[[str, str], Awaitable[None]] | None = None
        self._pending: list[QueueItem] = []
        self._current: QueueItem | None = None
        self._lock = asyncio.Lock()

    async def start(self, processor: Callable[[str, str], Awaitable[None]]) -> None:
        if self._worker_task is not None and not self._worker_task.done():
            return
        self._processor = processor
        self._worker_task = asyncio.create_task(self._worker_loop(), name="jobest-analysis-queue-worker")

    async def stop(self) -> None:
        if self._worker_task is None:
            return
        self._worker_task.cancel()
        try:
            await self._worker_task
        except asyncio.CancelledError:
            pass
        self._worker_task = None

    async def enqueue(self, user_id: str, candidate_id: str, analysis_run_id: str) -> int:
        item = QueueItem(user_id=user_id, candidate_id=candidate_id, analysis_run_id=analysis_run_id)
        async with self._lock:
            self._pending.append(item)
            queue_position = len(self._pending) + (1 if self._current is not None else 0)
        await self._queue.put(item)
        return queue_position

    async def has_pending_candidate(self, candidate_id: str) -> bool:
        async with self._lock:
            if self._current and self._current.candidate_id == candidate_id:
                return True
            return any(item.candidate_id == candidate_id for item in self._pending)

    async def snapshot(self, user_id: str) -> dict:
        async with self._lock:
            queue_size_total = len(self._pending)
            queue_size_user = sum(1 for item in self._pending if item.user_id == user_id)
            current = self._current
        return {
            "queue_size_total": queue_size_total,
            "queue_size_user": queue_size_user,
            "current": current,
        }

    async def _worker_loop(self) -> None:
        while True:
            item = await self._queue.get()
            async with self._lock:
                self._current = item
                self._pending = [queued for queued in self._pending if queued.analysis_run_id != item.analysis_run_id]
            try:
                if self._processor is not None:
                    await self._processor(item.candidate_id, item.analysis_run_id)
            finally:
                async with self._lock:
                    if self._current and self._current.analysis_run_id == item.analysis_run_id:
                        self._current = None
                self._queue.task_done()


analysis_queue_manager = AnalysisQueueManager()

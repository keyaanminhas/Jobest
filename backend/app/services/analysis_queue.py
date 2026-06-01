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
        self._queue: list[QueueItem] = []
        self._active: dict[str, QueueItem] = {}
        self._processor: Callable[[str, str, int], Awaitable[None]] | None = None
        self._worker_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self._wakeup = asyncio.Event()
        self._running = False
        self._limit_resolver: Callable[[str], Awaitable[int]] | None = None

    async def start(
        self,
        processor: Callable[[str, str, int], Awaitable[None]],
        limit_resolver: Callable[[str], Awaitable[int]],
    ) -> None:
        if self._worker_task is not None and not self._worker_task.done():
            return
        self._processor = processor
        self._limit_resolver = limit_resolver
        self._running = True
        self._worker_task = asyncio.create_task(self._dispatch_loop(), name="jobest-analysis-queue-dispatcher")

    async def stop(self) -> None:
        self._running = False
        self._wakeup.set()
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
            self._queue.append(item)
            user_queue = [queued for queued in self._queue if queued.user_id == user_id]
            queue_position = len(user_queue)
        self._wakeup.set()
        return queue_position

    async def has_pending_candidate(self, candidate_id: str) -> bool:
        async with self._lock:
            if any(active.candidate_id == candidate_id for active in self._active.values()):
                return True
            return any(item.candidate_id == candidate_id for item in self._queue)

    async def snapshot(self, user_id: str) -> dict:
        async with self._lock:
            queue_size_total = len(self._queue)
            queue_size_user = sum(1 for item in self._queue if item.user_id == user_id)
            active_items = list(self._active.values())
            active_user = [item for item in active_items if item.user_id == user_id]
            current = active_user[0] if active_user else None
        return {
            "queue_size_total": queue_size_total,
            "queue_size_user": queue_size_user,
            "current": current,
            "active_items": active_items,
            "active_user_count": len(active_user),
        }

    async def list_active_user_runs(self, user_id: str) -> list[QueueItem]:
        async with self._lock:
            return [item for item in self._active.values() if item.user_id == user_id]

    async def list_queued_user_runs(self, user_id: str) -> list[QueueItem]:
        async with self._lock:
            return [item for item in self._queue if item.user_id == user_id]

    async def _dispatch_loop(self) -> None:
        while self._running:
            item, slot = await self._next_dispatchable()
            if item is None:
                self._wakeup.clear()
                await self._wakeup.wait()
                continue
            if self._processor is None:
                continue
            asyncio.create_task(self._execute(item, slot), name=f"jobest-analysis-worker-{slot}")

    async def _execute(self, item: QueueItem, slot: int) -> None:
        try:
            if self._processor is not None:
                await self._processor(item.candidate_id, item.analysis_run_id, slot)
        finally:
            async with self._lock:
                self._active.pop(item.analysis_run_id, None)
            self._wakeup.set()

    async def _next_dispatchable(self) -> tuple[QueueItem | None, int]:
        async with self._lock:
            if not self._queue or self._limit_resolver is None:
                return None, 0

            for idx, item in enumerate(self._queue):
                user_active = [active for active in self._active.values() if active.user_id == item.user_id]
                user_limit = max(1, int(await self._limit_resolver(item.user_id)))
                if len(user_active) >= user_limit:
                    continue
                slots = {active.analysis_run_id: i + 1 for i, active in enumerate(user_active)}
                slot = 1
                while slot in slots.values():
                    slot += 1
                self._active[item.analysis_run_id] = item
                self._queue.pop(idx)
                return item, slot
        return None, 0


analysis_queue_manager = AnalysisQueueManager()

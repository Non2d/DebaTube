from typing import List, Tuple, Optional

from sqlalchemy import select, join
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

import models.task as task_model
import schemas.task as task_schema

async def create_task(
    db: AsyncSession, task_create: task_schema.TaskCreate
) -> task_model.Task:
    # task = task_model.Task(**task_create.model_dump()) #よくみたらコンストラクタか
    task = task_model.Task(
        motion=task_create.motion,
        source=task_create.source.model_dump(),
        POIs=task_create.POIs,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    rebuttals = [task_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, task_id=task.id) for rebuttal in task_create.rebuttals]
    db.add_all(rebuttals)
    await db.commit()
    await db.refresh(task)

    
    return task

async def get_tasks_with_done(db: AsyncSession) -> List[any]:
    result = await db.execute(
        select(task_model.Task).options(joinedload(task_model.Task.rebuttals))
    )
    tasks = result.scalars().unique().all()
    return tasks

async def get_task(db: AsyncSession, task_id: int) -> Optional[task_model.Task]:
    result: Result = await db.execute(
        select(task_model.Task).filter(task_model.Task.id == task_id)
        )
    task: Optional[Tuple[task_model.Task]] = result.first()
    return task[0] if task is not None else None

async def update_task(
        db:AsyncSession, task_create: task_schema.TaskCreate, original: task_model.Task
) -> task_model.Task:
    original.title = task_create.title
    db.add(original)
    await db.commit()
    await db.refresh(original)
    return original

async def delete_task(db: AsyncSession, original: task_model.Task) -> None:
    await db.delete(original)
    await db.commit()


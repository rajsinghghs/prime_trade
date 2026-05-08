from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException, status
from math import ceil

from app.models.models import Task, User, UserRole, TaskStatus, TaskPriority
from app.schemas.schemas import TaskCreate, TaskUpdate, TaskListResponse, TaskResponse


class TaskService:

    @staticmethod
    def create_task(db: Session, payload: TaskCreate, owner: User) -> Task:
        task = Task(
            title=payload.title.strip(),
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            owner_id=owner.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_tasks(
        db: Session,
        current_user: User,
        page: int = 1,
        page_size: int = 10,
        status_filter: TaskStatus | None = None,
        priority_filter: TaskPriority | None = None,
    ) -> TaskListResponse:
        query = db.query(Task).filter(Task.is_deleted == False)

        # Admins see all tasks; users see only their own
        if current_user.role != UserRole.ADMIN:
            query = query.filter(Task.owner_id == current_user.id)

        if status_filter:
            query = query.filter(Task.status == status_filter)
        if priority_filter:
            query = query.filter(Task.priority == priority_filter)

        total = query.count()
        tasks = (
            query.order_by(Task.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return TaskListResponse(
            tasks=[TaskResponse.model_validate(t) for t in tasks],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=ceil(total / page_size) if total else 0,
        )

    @staticmethod
    def get_task_by_id(db: Session, task_id: str, current_user: User) -> Task:
        task = db.query(Task).filter(
            Task.id == task_id, Task.is_deleted == False
        ).first()

        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        # Users can only access their own tasks
        if current_user.role != UserRole.ADMIN and task.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        return task

    @staticmethod
    def update_task(
        db: Session, task_id: str, payload: TaskUpdate, current_user: User
    ) -> Task:
        task = TaskService.get_task_by_id(db, task_id, current_user)

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def delete_task(db: Session, task_id: str, current_user: User) -> None:
        task = TaskService.get_task_by_id(db, task_id, current_user)
        task.is_deleted = True  # soft delete
        db.commit()
